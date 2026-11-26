"use client";

import { useMemo, useState, useTransition } from "react";
import { useUiStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Ellipsis,
  Gauge,
  Palette,
  PanelLeftClose,
  Pencil,
  Plus,
  Shapes,
  Trash2,
} from "lucide-react";
import { updateProjectStatusesAction } from "@/server/actions/project.actions";
import type { StatusCategory, StatusDTO } from "@/server/db/types";
import { STATUS_COLORS, STATUS_COLOR_KEYS, statusHex, type StatusColor } from "@/lib/status-colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES: { value: StatusCategory; label: string; hint?: string }[] = [
  { value: "TODO", label: "A fazer" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "DONE", label: "Concluído", hint: "conta como feito" },
];

const tasksLabel = (n: number) => (n === 1 ? "1 tarefa" : `${n} tarefas`);

/** Grava a lista inteira de colunas (a action valida e move as tarefas de colunas removidas). */
function useSaveColumns(projectId: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const save = (
    next: StatusDTO[],
    options: { moveTasksTo?: Record<string, string>; done?: () => void } = {}
  ) =>
    startTransition(async () => {
      const result = await updateProjectStatusesAction({
        projectId,
        statuses: next.map(({ id, name, category, color, wipLimit }) => ({
          id: id || undefined,
          name,
          category,
          color,
          wipLimit,
        })),
        moveTasksTo: options.moveTasksTo,
      });
      if (!result.success) return void toast.error(result.error);
      options.done?.();
      router.refresh();
    });
  return { save, pending };
}

/** Cabeçalho da coluna: cor, nome (renomeia no lugar), contagem com o limite e o menu. */
export function ColumnHeader({
  projectId,
  statuses,
  status,
  count,
  total,
  canManage,
  onCollapse,
  addTask,
}: {
  projectId: string;
  statuses: StatusDTO[];
  status: StatusDTO;
  /** Tarefas visíveis com os filtros. */
  count: number;
  /** Todas as tarefas da coluna (o limite conta todas). */
  total: number;
  canManage: boolean;
  onCollapse: () => void;
  addTask: React.ReactNode;
}) {
  const { save, pending } = useSaveColumns(projectId);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(status.name);
  const [limitOpen, setLimitOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const index = statuses.findIndex((s) => s.id === status.id);
  const over = status.wipLimit !== null && total > status.wipLimit;
  const patch = (changes: Partial<StatusDTO>) =>
    save(statuses.map((s) => (s.id === status.id ? { ...s, ...changes } : s)));
  const move = (delta: number) => {
    const next = [...statuses];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    save(next);
  };

  function finishRename() {
    setRenaming(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== status.name) patch({ name: trimmed });
    else setName(status.name);
  }

  return (
    <div className="flex flex-col gap-1 px-1">
      <div className="flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: statusHex(status) }}
          aria-hidden="true"
        />
        {renaming ? (
          <Input
            autoFocus
            aria-label={`Novo nome da coluna ${status.name}`}
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onBlur={finishRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setName(status.name);
                setRenaming(false);
              }
            }}
            className="h-7 min-w-0 flex-1 px-1.5 text-sm font-semibold"
          />
        ) : (
          <h2 id={`col-${status.id}`} className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <span className="line-clamp-2 break-words" title={status.name}>
              {status.name}
            </span>
            <span
              className={
                over
                  ? "rounded-md border border-destructive-border bg-destructive/10 px-1.5 text-xs font-medium text-destructive-text tabular-nums"
                  : "font-medium text-muted-foreground tabular-nums"
              }
            >
              {count}
              {status.wipLimit !== null && `/${status.wipLimit}`}
              {over && <span className="sr-only">, acima do limite</span>}
            </span>
          </h2>
        )}
        <span className="ml-auto flex shrink-0 items-center">
          {addTask}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Opções da coluna ${status.name}`}
                disabled={pending}
              >
                <Ellipsis aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {canManage && (
                <>
                  <DropdownMenuItem onSelect={() => setRenaming(true)}>
                    <Pencil aria-hidden="true" />
                    Renomear
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Palette aria-hidden="true" />
                      Cor
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup
                        value={status.color ?? "auto"}
                        onValueChange={(v) => patch({ color: v === "auto" ? null : (v as StatusColor) })}
                      >
                        <DropdownMenuRadioItem value="auto">Automática (pelo tipo)</DropdownMenuRadioItem>
                        {STATUS_COLOR_KEYS.map((c) => (
                          <DropdownMenuRadioItem key={c} value={c}>
                            <span
                              className="size-3 rounded-full"
                              style={{ background: STATUS_COLORS[c].hex }}
                              aria-hidden="true"
                            />
                            {STATUS_COLORS[c].label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem onSelect={() => setLimitOpen(true)}>
                    <Gauge aria-hidden="true" />
                    Limite de tarefas…
                    {status.wipLimit !== null && (
                      <span className="ml-auto text-xs text-muted-foreground">{status.wipLimit}</span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Shapes aria-hidden="true" />
                      Tipo da coluna
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup
                        value={status.category}
                        onValueChange={(v) => patch({ category: v as StatusCategory })}
                      >
                        {CATEGORIES.map((c) => (
                          <DropdownMenuRadioItem key={c.value} value={c.value}>
                            {c.label}
                            {c.hint && (
                              <span className="ml-auto pl-3 text-xs text-muted-foreground">{c.hint}</span>
                            )}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={index === 0} onSelect={() => move(-1)}>
                    <ArrowLeft aria-hidden="true" />
                    Mover para a esquerda
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={index === statuses.length - 1} onSelect={() => move(1)}>
                    <ArrowRight aria-hidden="true" />
                    Mover para a direita
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setAddOpen(true)}>
                    <Plus aria-hidden="true" />
                    Adicionar coluna à direita
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onSelect={onCollapse}>
                <PanelLeftClose aria-hidden="true" />
                Recolher coluna
              </DropdownMenuItem>
              {canManage && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                    <Trash2 aria-hidden="true" />
                    Excluir coluna…
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>
      {over && (
        <p className="text-xs text-destructive-text">Acima do limite de {tasksLabel(status.wipLimit!)}</p>
      )}

      {canManage && (
        <>
          <LimitDialog
            key={`limit-${status.wipLimit}-${limitOpen}`}
            open={limitOpen}
            onOpenChange={setLimitOpen}
            status={status}
            pending={pending}
            onSave={(wipLimit) => patch({ wipLimit })}
          />
          <NewColumnDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            pending={pending}
            onSave={(columnName) => {
              const next = [...statuses];
              next.splice(index + 1, 0, newColumn(columnName));
              save(next, { done: () => setAddOpen(false) });
            }}
          />
          <DeleteColumnDialog
            key={`delete-${statuses.map((s) => s.id).join()}`}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            statuses={statuses}
            status={status}
            taskCount={total}
            onDelete={(targetId) =>
              save(
                statuses.filter((s) => s.id !== status.id),
                { moveTasksTo: targetId ? { [status.id]: targetId } : undefined }
              )
            }
          />
        </>
      )}
    </div>
  );
}

/** Coluna nova entra como "em andamento", que é o caso mais comum entre A fazer e Concluído. */
const newColumn = (name: string): StatusDTO => ({
  id: "",
  name,
  category: "IN_PROGRESS",
  color: null,
  wipLimit: null,
});

function LimitDialog({
  open,
  onOpenChange,
  status,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: StatusDTO;
  pending: boolean;
  onSave: (limit: number | null) => void;
}) {
  const [value, setValue] = useState(status.wipLimit?.toString() ?? "");
  const n = Number(value);
  const invalid = value.trim() !== "" && (!Number.isInteger(n) || n < 1 || n > 999);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (invalid) return;
            onSave(value.trim() === "" ? null : n);
            onOpenChange(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Limite de “{status.name}”</DialogTitle>
            <DialogDescription>
              Com mais tarefas do que o limite, a coluna fica em vermelho. Mover continua permitido.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`wip-${status.id}`} className="text-sm font-medium">
              Máximo de tarefas
            </label>
            <Input
              id={`wip-${status.id}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              value={value}
              placeholder="Sem limite"
              aria-invalid={invalid}
              aria-describedby={`wip-help-${status.id}`}
              onChange={(e) => setValue(e.target.value)}
              className="max-w-32"
            />
            <p
              id={`wip-help-${status.id}`}
              className={invalid ? "text-xs text-destructive-text" : "text-xs text-muted-foreground"}
            >
              {invalid ? "Use um número inteiro de 1 a 999." : "Deixe vazio para não ter limite."}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={invalid || pending}>
              Salvar limite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewColumnDialog({
  open,
  onOpenChange,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setName("");
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onSave(name.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>Nova coluna</DialogTitle>
            <DialogDescription>
              Entra como “Em andamento”; o tipo e a cor mudam no menu da coluna.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-column-name" className="text-sm font-medium">
              Nome
            </label>
            <Input
              id="new-column-name"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || pending}>
              Adicionar coluna
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteColumnDialog({
  open,
  onOpenChange,
  statuses,
  status,
  taskCount,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses: StatusDTO[];
  status: StatusDTO;
  taskCount: number;
  onDelete: (targetId: string | null) => void;
}) {
  const others = statuses.filter((s) => s.id !== status.id);
  const fallback = others.find((s) => s.category === status.category) ?? others[0];
  const [target, setTarget] = useState(fallback?.id ?? "");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir a coluna “{status.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {taskCount === 0
              ? "A coluna está vazia."
              : `As ${tasksLabel(taskCount)} dela vão para outra coluna. Nenhuma tarefa é excluída.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {taskCount > 0 && (
          <div className="flex flex-col gap-1.5">
            <span id={`move-to-${status.id}`} className="text-sm font-medium">
              Mover as tarefas para
            </span>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger aria-labelledby={`move-to-${status.id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {others.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: statusHex(s) }}
                      aria-hidden="true"
                    />
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => onDelete(taskCount > 0 ? target : null)}>
            Excluir coluna
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Coluna recolhida: uma faixa estreita com cor, nome e total; clicar abre de novo. */
export function CollapsedColumn({
  status,
  count,
  onExpand,
  dropRef,
  isOver,
}: {
  status: StatusDTO;
  count: number;
  onExpand: () => void;
  dropRef: (el: HTMLElement | null) => void;
  isOver: boolean;
}) {
  return (
    <section
      ref={dropRef}
      aria-label={`${status.name}, recolhida, ${tasksLabel(count)}`}
      className={`flex min-h-64 w-11 shrink-0 flex-col items-center gap-2.5 rounded-xl py-2.5 transition-colors ${isOver ? "bg-accent" : "bg-muted"}`}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Expandir a coluna ${status.name}`}
        onClick={onExpand}
      >
        <ArrowRight aria-hidden="true" />
      </Button>
      <span className="size-2.5 rounded-full" style={{ background: statusHex(status) }} aria-hidden="true" />
      <span className="text-sm font-semibold [writing-mode:vertical-rl]" aria-hidden="true">
        {status.name} <span className="font-medium text-muted-foreground">{count}</span>
      </span>
    </section>
  );
}

/** Fim do quadro: criar coluna digitando o nome (só admin e dono). */
export function AddColumn({ projectId, statuses }: { projectId: string; statuses: StatusDTO[] }) {
  const { save, pending } = useSaveColumns(projectId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const close = () => {
    setEditing(false);
    setName("");
  };

  if (!editing) {
    return (
      <Button
        variant="ghost"
        className="h-11 w-[220px] shrink-0 justify-start border border-dashed border-border-strong text-muted-foreground"
        onClick={() => setEditing(true)}
      >
        <Plus aria-hidden="true" />
        Nova coluna
      </Button>
    );
  }
  return (
    <form
      className="flex w-[240px] shrink-0 flex-col gap-2 rounded-xl border border-dashed border-border-strong p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (trimmed) save([...statuses, newColumn(trimmed)], { done: close });
      }}
    >
      <label htmlFor="board-new-column" className="px-0.5 text-xs text-muted-foreground">
        Nova coluna
      </label>
      <Input
        id="board-new-column"
        autoFocus
        value={name}
        maxLength={40}
        placeholder="Ex.: Aguardando cliente"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && close()}
      />
      <div className="flex gap-1.5">
        <Button type="submit" size="sm" disabled={!name.trim() || pending}>
          Adicionar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={close}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

const NONE: string[] = [];

/** Colunas recolhidas deste projeto (store/ui-store.ts, guardadas no navegador da pessoa). */
export function useCollapsedColumns(projectId: string) {
  const ids = useUiStore((s) => s.collapsedColumns[projectId] ?? NONE);
  const toggleColumn = useUiStore((s) => s.toggleColumn);
  const collapsed = useMemo(() => new Set(ids), [ids]);
  return { collapsed, toggle: (id: string) => toggleColumn(projectId, id) };
}
