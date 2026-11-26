"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { GripVertical, Plus, UserRound } from "lucide-react";
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
import { moveTaskAction } from "@/server/actions/task.actions";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { filterTasks, hasFilters, parseTaskFilters } from "@/lib/task-filters";
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

type Columns = Record<string, TaskDTO[]>;

const group = (statuses: StatusDTO[], tasks: TaskDTO[]): Columns =>
  Object.fromEntries(statuses.map((s) => [s.id, tasks.filter((t) => t.statusId === s.id)]));

interface BoardProps {
  projectId: string;
  statuses: StatusDTO[];
  tasks: TaskDTO[];
  currentUserId: string;
  /** Prefixo do link das tarefas: /w/slug/projects/KEY/tasks */
  taskHref: string;
  now: string;
}

/**
 * Quadro kanban com arrastar e soltar (mouse, toque ou teclado). A mudança aparece na hora e
 * volta ao estado anterior se o servidor recusar. Com filtros ativos o arraste fica desligado,
 * porque a posição entre tarefas escondidas seria ambígua.
 */
export function Board({ projectId, statuses, tasks, currentUserId, taskHref, now }: BoardProps) {
  const router = useRouter();
  const params = useSearchParams();
  const filters = parseTaskFilters((k) => params.get(k));
  const filtering = hasFilters(filters);

  // estado local para o movimento otimista; volta a seguir o servidor quando os dados mudam
  const [source, setSource] = useState(tasks);
  const [columns, setColumns] = useState(() => group(statuses, tasks));
  const [snapshot, setSnapshot] = useState<Columns | null>(null);
  if (source !== tasks) {
    setSource(tasks);
    setColumns(group(statuses, tasks));
  }

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
  const statusName = (id?: string) => statuses.find((s) => s.id === id)?.name ?? "";

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = containerOf(active.id);
    const to = containerOf(over.id);
    if (!from || !to || from === to) return;
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
        [to]: [...target.slice(0, index), { ...moving, statusId: to }, ...target.slice(index)],
      };
    });
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    const before = snapshot;
    setSnapshot(null);
    const column = over ? containerOf(over.id) : undefined;
    if (!before || !column) {
      if (before) setColumns(before);
      return;
    }

    let list = columns[column]!;
    const oldIndex = list.findIndex((t) => t.id === active.id);
    const overIndex = list.findIndex((t) => t.id === over!.id);
    if (oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex)
      list = arrayMove(list, oldIndex, overIndex);
    const next = { ...columns, [column]: list };
    setColumns(next);

    const index = list.findIndex((t) => t.id === active.id);
    const afterTaskId = list[index - 1]?.id ?? null;
    const original = Object.entries(before).find(([, ts]) => ts.some((t) => t.id === active.id));
    const originalAfter = original?.[1][original[1].findIndex((t) => t.id === active.id) - 1]?.id ?? null;
    if (original?.[0] === column && originalAfter === afterTaskId) return; // soltou onde estava

    const result = await moveTaskAction({ taskId: String(active.id), statusId: column, afterTaskId });
    if (!result.success) {
      setColumns(before);
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Arrastando ${taskById(active.id)?.code}.`,
    onDragOver: ({ active, over }) =>
      over ? `${taskById(active.id)?.code} sobre ${statusName(containerOf(over.id))}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${taskById(active.id)?.code} solta em ${statusName(containerOf(over.id))}.`
        : `${taskById(active.id)?.code} voltou ao lugar.`,
    onDragCancel: ({ active }) => `Movimento cancelado. ${taskById(active.id)?.code} voltou ao lugar.`,
  };

  const nowDate = new Date(now);

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
        <div className="flex min-w-min items-start gap-3.5">
          {statuses.map((status) => {
            const all = columns[status.id] ?? [];
            const visible = filtering ? filterTasks(all, filters, currentUserId) : all;
            return (
              <Column
                key={status.id}
                status={status}
                count={visible.length}
                header={
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
              >
                <SortableContext items={visible.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {visible.length === 0 ? (
                    <p className="rounded-[10px] border border-dashed border-border-strong p-4 text-center text-[13px] text-muted-foreground">
                      {filtering
                        ? "Nenhuma tarefa com esses filtros."
                        : "Nenhuma tarefa aqui. Use + para criar."}
                    </p>
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
              </Column>
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}

function Column({
  status,
  count,
  header,
  children,
}: {
  status: StatusDTO;
  count: number;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  // a coluna também recebe a tarefa, para dar para soltar em coluna vazia
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`col-${status.id}`}
      className={cn(
        "flex min-h-32 w-[260px] shrink-0 flex-col gap-2.5 rounded-xl bg-muted p-2.5 transition-colors",
        isOver && "bg-accent"
      )}
    >
      <div className="flex items-center justify-between px-1">
        <h2 id={`col-${status.id}`} className="flex items-center gap-2 text-sm font-semibold">
          {status.name}
          <span className="font-medium text-muted-foreground">{count}</span>
        </h2>
        {header}
      </div>
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
        "relative touch-manipulation rounded-[10px] shadow-xs transition-colors hover:border-border-strong has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50",
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
