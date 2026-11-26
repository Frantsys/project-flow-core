"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, GripVertical, Plus, UserRound } from "lucide-react";
import {
  closestCorners,
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { moveTaskAction, updateTaskAction } from "@/server/actions/task.actions";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { filterTasks, hasFilters, parseTaskFilters } from "@/lib/task-filters";
import { laneChange, laneOf, lanesFor, parseGroupBy, type GroupBy } from "@/lib/board-lanes";
import { pointsLabel, priorityBadge, shortDate } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { StatusDTO, TaskDTO } from "@/server/db/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/user-avatar";
import { TaskTypeIndicator } from "./task-type";
import { CreateTaskDialog } from "./create-task-dialog";
import { TaskStatusMenu } from "./task-status-menu";
import { TagChip } from "@/components/tasks/task-tags";
import { AddColumn, CollapsedColumn, ColumnHeader, useCollapsedColumns } from "./column-controls";

type Columns = Record<string, TaskDTO[]>;

// sem faixas a chave é o id do status; com faixas, "faixa::status"
const SEP = "::";
const keyOf = (lane: string | null, statusId: string) =>
  lane === null ? statusId : `${lane}${SEP}${statusId}`;
const statusOf = (key: string) => key.split(SEP).at(-1)!;
const laneOfKey = (key: string) => (key.includes(SEP) ? key.split(SEP)[0]! : null);

function group(statuses: StatusDTO[], tasks: TaskDTO[], by: GroupBy | null): Columns {
  const lanes = by ? lanesFor(tasks, by).map((l) => l.key) : [null];
  const columns: Columns = {};
  for (const lane of lanes)
    for (const s of statuses)
      columns[keyOf(lane, s.id)] = tasks.filter(
        (t) => t.statusId === s.id && (lane === null || laneOf(t, by!) === lane)
      );
  return columns;
}

interface BoardProps {
  projectId: string;
  statuses: StatusDTO[];
  tasks: TaskDTO[];
  currentUserId: string;
  /** Prefixo do link das tarefas: /w/slug/projects/KEY/tasks */
  taskHref: string;
  now: string;
  /** Admin e dono: adicionam, renomeiam, movem e excluem colunas. */
  canManageColumns?: boolean;
}

/**
 * Quadro kanban com arrastar e soltar (mouse ou toque). A mudança aparece na hora e volta ao
 * estado anterior se o servidor recusar. Com filtros ativos o arraste fica desligado, porque a
 * posição entre tarefas escondidas seria ambígua. Com ?group= o quadro vira faixas; soltar em
 * outra faixa troca o responsável, a prioridade ou o tipo.
 */
export function Board({
  projectId,
  statuses,
  tasks,
  currentUserId,
  taskHref,
  now,
  canManageColumns = false,
}: BoardProps) {
  const { collapsed, toggle } = useCollapsedColumns(projectId);
  const router = useRouter();
  const params = useSearchParams();
  const filters = parseTaskFilters((k) => params.get(k));
  const filtering = hasFilters(filters);
  const groupBy = parseGroupBy(params.get("group"));
  const [closedLanes, setClosedLanes] = useState<Set<string>>(new Set());

  // estado local para o movimento otimista; volta a seguir o servidor quando os dados mudam
  const [source, setSource] = useState({ tasks, statuses, groupBy });
  const [columns, setColumns] = useState(() => group(statuses, tasks, groupBy));
  const [snapshot, setSnapshot] = useState<Columns | null>(null);
  if (source.tasks !== tasks || source.statuses !== statuses || source.groupBy !== groupBy) {
    setSource({ tasks, statuses, groupBy });
    setColumns(group(statuses, tasks, groupBy));
  }
  const lanes = groupBy ? lanesFor(tasks, groupBy) : [];

  const containerOf = (id: UniqueIdentifier) =>
    id in columns ? String(id) : Object.keys(columns).find((c) => columns[c]!.some((t) => t.id === id));

  // sem tempo real: busca de novo ao voltar para a aba, mas nunca no meio de um arraste
  useRefreshOnFocus(!snapshot);

  const sensors = useSensors(
    // 6 px antes de começar: um clique simples continua abrindo a tarefa
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
    // sem KeyboardSensor: com a página ou o quadro rolando, o sensor de teclado do dnd-kit rola em
    // vez de mover. Pelo teclado, o menu "Mover para…" de cada card troca a coluna e a posição.
  );
  const taskById = (id: UniqueIdentifier) => tasks.find((t) => t.id === id);
  const placeName = (key?: string) => {
    if (!key) return "";
    const status = statuses.find((s) => s.id === statusOf(key))?.name ?? "";
    const lane = lanes.find((l) => l.key === laneOfKey(key));
    return lane ? `${status}, ${lane.label}` : status;
  };

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = containerOf(active.id);
    const to = containerOf(over.id);
    if (!from || !to || from === to) return;
    // por etiqueta não dá para trocar de faixa: só de coluna
    if (groupBy === "tag" && laneOfKey(from) !== laneOfKey(to)) return;
    // atravessou para outra coluna: move já, para a coluna de destino abrir espaço
    setColumns((cols) => {
      const moving = cols[from]!.find((t) => t.id === active.id);
      if (!moving) return cols;
      const target = cols[to]!;
      const overIndex = target.findIndex((t) => t.id === over.id);
      const index = overIndex >= 0 ? overIndex : target.length;
      return {
        ...cols,
        [from]: cols[from]!.filter((t) => t.id !== active.id),
        [to]: [...target.slice(0, index), { ...moving, statusId: statusOf(to) }, ...target.slice(index)],
      };
    });
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    const before = snapshot;
    setSnapshot(null);
    const column = over ? containerOf(over.id) : undefined;
    const original = before && Object.entries(before).find(([, ts]) => ts.some((t) => t.id === active.id));
    if (
      !before ||
      !column ||
      !original ||
      (groupBy === "tag" && laneOfKey(column) !== laneOfKey(original[0]))
    ) {
      if (before) setColumns(before);
      return;
    }

    let list = columns[column]!;
    const oldIndex = list.findIndex((t) => t.id === active.id);
    const overIndex = list.findIndex((t) => t.id === over!.id);
    if (oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex)
      list = arrayMove(list, oldIndex, overIndex);
    setColumns({ ...columns, [column]: list });

    const index = list.findIndex((t) => t.id === active.id);
    const afterTaskId = list[index - 1]?.id ?? null;
    const originalAfter = original[1][original[1].findIndex((t) => t.id === active.id) - 1]?.id ?? null;
    if (original[0] === column && originalAfter === afterTaskId) return; // soltou onde estava

    const taskId = String(active.id);
    const result = await moveTaskAction({ taskId, statusId: statusOf(column), afterTaskId });
    const lane = laneOfKey(column);
    const change = groupBy && lane !== laneOfKey(original[0]) ? laneChange(groupBy, lane!) : null;
    const second = result.success && change ? await updateTaskAction({ taskId, ...change }) : result;
    if (!second.success) {
      setColumns(before);
      toast.error(second.error);
      return;
    }
    router.refresh();
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Arrastando ${taskById(active.id)?.code}.`,
    onDragOver: ({ active, over }) =>
      over ? `${taskById(active.id)?.code} sobre ${placeName(containerOf(over.id))}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${taskById(active.id)?.code} solta em ${placeName(containerOf(over.id))}.`
        : `${taskById(active.id)?.code} voltou ao lugar.`,
    onDragCancel: ({ active }) => `Movimento cancelado. ${taskById(active.id)?.code} voltou ao lugar.`,
  };

  const nowDate = new Date(now);
  const visibleIn = (key: string) => {
    const all = columns[key] ?? [];
    return filtering ? filterTasks(all, filters, currentUserId) : all;
  };
  // contagem do cabeçalho: a coluna inteira, somando as faixas
  const countOf = (statusId: string) => {
    const keys = groupBy ? lanes.map((l) => keyOf(l.key, statusId)) : [statusId];
    return {
      visible: keys.reduce((n, k) => n + visibleIn(k).length, 0),
      total: keys.reduce((n, k) => n + (columns[k]?.length ?? 0), 0),
    };
  };

  const header = (status: StatusDTO) => {
    const { visible, total } = countOf(status.id);
    return (
      <ColumnHeader
        projectId={projectId}
        statuses={statuses}
        status={status}
        count={visible}
        total={total}
        canManage={canManageColumns}
        onCollapse={() => toggle(status.id)}
        addTask={
          <CreateTaskDialog
            projectId={projectId}
            statuses={statuses}
            defaultStatusId={status.id}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Nova tarefa em ${status.name}`}>
                <Plus aria-hidden="true" />
              </Button>
            }
          />
        }
      />
    );
  };

  // empty = null: célula de faixa vazia fica em branco (o aviso repetido em cada célula polui)
  const cards = (key: string, empty: string | null) => {
    const visible = visibleIn(key);
    return (
      <SortableContext items={visible.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {visible.length === 0 ? (
          empty === null ? null : (
            <p className="rounded-[10px] border border-dashed border-border-strong p-4 text-center text-[13px] text-muted-foreground">
              {filtering ? "Nenhuma tarefa com esses filtros." : empty}
            </p>
          )
        ) : (
          visible.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              statuses={statuses}
              href={`${taskHref}/${task.code}`}
              now={nowDate}
              disabled={filtering}
            />
          ))
        )}
      </SortableContext>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "Para mover pelo teclado, use o menu Mover para do card.",
        },
      }}
      onDragStart={() => setSnapshot(columns)}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        if (snapshot) setColumns(snapshot);
        setSnapshot(null);
      }}
    >
      {/* O quadro rola na horizontal dentro do próprio container, nunca a página */}
      <div className="-mx-6 overflow-x-auto px-6 pb-2 md:-mx-8 md:px-8">
        {!groupBy ? (
          <div className="flex min-w-min items-start gap-3.5">
            {statuses.map((status) =>
              collapsed.has(status.id) ? (
                <DroppableCollapsed
                  key={status.id}
                  id={status.id}
                  status={status}
                  count={countOf(status.id).visible}
                  onExpand={() => toggle(status.id)}
                />
              ) : (
                <Column key={status.id} id={status.id} labelledBy={`col-${status.id}`}>
                  {header(status)}
                  {cards(status.id, "Nenhuma tarefa aqui. Use + para criar.")}
                </Column>
              )
            )}
            {canManageColumns && <AddColumn projectId={projectId} statuses={statuses} />}
          </div>
        ) : (
          <div className="flex min-w-min flex-col gap-3">
            {/* cabeçalhos das colunas uma vez só, em cima das faixas */}
            <div className="flex items-start gap-3.5">
              {statuses.map((status) =>
                collapsed.has(status.id) ? (
                  <Button
                    key={status.id}
                    variant="ghost"
                    size="icon-sm"
                    className="w-11 shrink-0"
                    aria-label={`Expandir a coluna ${status.name}`}
                    onClick={() => toggle(status.id)}
                  >
                    <ChevronRight aria-hidden="true" />
                  </Button>
                ) : (
                  <div key={status.id} className="w-[260px] shrink-0 px-2.5">
                    {header(status)}
                  </div>
                )
              )}
              {canManageColumns && <AddColumn projectId={projectId} statuses={statuses} />}
            </div>
            {lanes.map((lane, laneIndex) => {
              const open = !closedLanes.has(lane.key);
              const count = statuses.reduce((n, s) => n + visibleIn(keyOf(lane.key, s.id)).length, 0);
              // com filtros, faixa sem nenhuma tarefa visível some
              if (filtering && count === 0) return null;
              return (
                <section key={lane.key} aria-labelledby={`lane-${laneIndex}`} className="flex flex-col gap-2">
                  <h3 id={`lane-${laneIndex}`} className="text-sm font-semibold">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() =>
                        setClosedLanes((s) => {
                          const next = new Set(s);
                          if (next.has(lane.key)) next.delete(lane.key);
                          else next.add(lane.key);
                          return next;
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <ChevronDown
                        className={cn("size-4 transition-transform", !open && "-rotate-90")}
                        aria-hidden="true"
                      />
                      {lane.person && (
                        <UserAvatar name={lane.person.name} image={lane.person.image} size="sm" />
                      )}
                      {lane.label}
                      <span className="font-medium text-muted-foreground tabular-nums">{count}</span>
                    </button>
                  </h3>
                  {open && (
                    <div className="flex items-start gap-3.5">
                      {statuses.map((status) => {
                        const key = keyOf(lane.key, status.id);
                        return collapsed.has(status.id) ? (
                          <LaneStrip key={key} id={key} label={`${status.name}, ${lane.label}`} />
                        ) : (
                          <Column key={key} id={key} label={`${status.name}, ${lane.label}`} compact>
                            {cards(key, null)}
                          </Column>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </DndContext>
  );
}

function DroppableCollapsed({
  id,
  ...props
}: {
  id: string;
  status: StatusDTO;
  count: number;
  onExpand: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <CollapsedColumn {...props} dropRef={setNodeRef} isOver={isOver} />;
}

/** Coluna recolhida dentro de uma faixa: só a faixa estreita, que ainda recebe cards. */
function LaneStrip({ id, label }: { id: string; label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      aria-label={`${label}, recolhida`}
      className={cn("min-h-16 w-11 shrink-0 self-stretch rounded-xl", isOver ? "bg-accent" : "bg-muted")}
    />
  );
}

function Column({
  id,
  labelledBy,
  label,
  compact,
  children,
}: {
  id: string;
  labelledBy?: string;
  label?: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  // a coluna também recebe a tarefa, para dar para soltar em coluna vazia
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={labelledBy}
      aria-label={label}
      className={cn(
        "flex w-[260px] shrink-0 flex-col gap-2.5 rounded-xl bg-muted p-2.5 transition-colors",
        compact ? "min-h-16" : "min-h-32",
        isOver && "bg-accent"
      )}
    >
      {children}
    </section>
  );
}

function SortableTaskCard({
  task,
  statuses,
  href,
  now,
  disabled,
}: {
  task: TaskDTO;
  statuses: StatusDTO[];
  href: string;
  now: Date;
  disabled: boolean;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled });
  const priority = priorityBadge[task.priority];
  const due = task.dueDate ? shortDate(task.dueDate, now) : null;
  const overdue = task.dueDate ? new Date(task.dueDate) < now : false;

  return (
    <Card
      ref={setNodeRef}
      size="sm"
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // arrasta pelo card inteiro (mouse ou toque); Enter no título continua abrindo a tarefa
      onPointerDown={listeners?.onPointerDown as React.PointerEventHandler<HTMLDivElement> | undefined}
      className={cn(
        "relative touch-manipulation rounded-[10px] shadow-xs transition-[translate,box-shadow,border-color] duration-150 hover:-translate-y-px hover:border-border-strong hover:shadow-sm has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        isDragging && "z-20 opacity-80 shadow-lg ring-2 ring-ring/40"
      )}
    >
      <CardHeader className="flex items-center gap-2">
        {!disabled && (
          // só visual: indica que o card pode ser arrastado
          <GripVertical
            className="-ml-1 size-4 shrink-0 cursor-grab text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <TaskTypeIndicator type={task.type} />
        <span className="font-mono text-xs font-medium text-text-secondary">{task.code}</span>
        <Badge variant={priority.variant} className="ml-auto">
          {priority.label}
        </Badge>
        <div className="relative z-10">
          <TaskStatusMenu
            taskId={task.id}
            taskCode={task.code}
            statusId={task.statusId}
            statuses={statuses}
            canReorder={!disabled}
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <CardTitle className="line-clamp-3 text-sm leading-snug font-medium">
          {/* o link cobre o card inteiro (after:inset-0); alça e menu ficam por cima com z-10 */}
          <Link
            href={href}
            scroll={false}
            draggable={false}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {task.title}
          </Link>
        </CardTitle>
        {task.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label="Etiquetas">
            {task.tags.map((tag) => (
              <li key={tag}>
                <TagChip tag={tag} />
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          {task.storyPoints !== null && (
            <Badge variant="outline" className="h-5 px-1.5">
              {pointsLabel(task.storyPoints)}
            </Badge>
          )}
          {due && (
            <span className={cn((overdue || due === "hoje") && "font-medium text-destructive-text")}>
              {due}
            </span>
          )}
          {task.sprint && <span className="truncate">{task.sprint.name}</span>}
          {task.assignee ? (
            <UserAvatar name={task.assignee.name} image={task.assignee.image} size="sm" className="ml-auto" />
          ) : (
            <Avatar className="ml-auto size-6" title="Sem responsável">
              <AvatarFallback className="bg-avatar text-badge-foreground">
                <UserRound className="size-3.5" aria-label="Sem responsável" />
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
