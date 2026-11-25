"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ellipsis, Link2, Trash2, X } from "lucide-react";
import {
  addCommentAction,
  addSubtaskAction,
  deleteCommentAction,
  deleteSubtaskAction,
  deleteTaskAction,
  toggleSubtaskAction,
  updateTaskAction,
} from "@/server/actions/task.actions";
import { describeHistory, timeAgo } from "@/lib/history-format";
import { priorityBadge, typeLabel } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { UserAvatar } from "@/components/user-avatar";
import { TaskTypeIndicator } from "@/components/projects/task-type";
import type {
  ProjectSprintSummaryDTO,
  TaskDetailDTO,
  TaskPriority,
  WorkspaceMemberDTO,
} from "@/server/db/types";
import type { WorkspaceRole } from "@/server/db/models";

const NONE = "none"; // o Select do Radix não aceita valor vazio
const TYPES = ["TASK", "BUG", "STORY"] as const;
const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

type ActionResultLike = { success: true } | { success: false; error: string };

export interface TaskDetailProps {
  task: TaskDetailDTO;
  statuses: string[];
  sprints: ProjectSprintSummaryDTO[];
  members: WorkspaceMemberDTO[];
  currentUser: { id: string; role: WorkspaceRole };
  boardUrl: string;
  /** No Sheet, `X` fecha o painel; na página, volta ao quadro. */
  onClose?: () => void;
}

export function TaskDetail({
  task,
  statuses,
  sprints,
  members,
  currentUser,
  boardUrl,
  onClose,
}: TaskDetailProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [newSubtask, setNewSubtask] = useState("");
  const [comment, setComment] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canDeleteTask = currentUser.role !== "MEMBER" || task.reporter?.id === currentUser.id;
  const doneCount = task.subtasks.filter((s) => s.isCompleted).length;

  /** Roda uma action, avisa o erro e atualiza os dados do servidor. */
  function run(action: () => Promise<ActionResultLike>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  }

  const update = (data: Omit<Parameters<typeof updateTaskAction>[0], "taskId">) =>
    run(() => updateTaskAction({ taskId: task.id, ...data }));

  function copyLink() {
    const url = `${window.location.origin}${boardUrl}/tasks/${task.code}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copiado."),
      () => toast.error("Não foi possível copiar. Copie o endereço da barra do navegador.")
    );
  }

  const assignableSprints = sprints.filter((s) => s.status !== "COMPLETED" || s.id === task.sprint?.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2.5 border-b px-5 py-3">
        <TaskTypeIndicator type={task.type} />
        <span className="font-mono text-[13px] font-medium text-text-secondary">{task.code}</span>
        <Badge variant="outline">{typeLabel[task.type]}</Badge>
        {pending && <Spinner className="text-muted-foreground" />}
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={copyLink}>
          <Link2 aria-hidden="true" />
          Copiar link
        </Button>
        {canDeleteTask && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Mais ações">
                <Ellipsis aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden="true" />
                Excluir tarefa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {onClose && (
          <Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
        <label className="sr-only" htmlFor="task-title">
          Título
        </label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== task.title && update({ title })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="h-auto border-transparent px-1 text-[22px] font-semibold tracking-tight shadow-none hover:border-input md:text-[22px]"
        />

        <dl className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-sm">
          <dt id="lbl-status" className="text-[13px] text-muted-foreground">
            Status
          </dt>
          <dd>
            <Select value={task.status} onValueChange={(status) => update({ status })}>
              <SelectTrigger aria-labelledby="lbl-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </dd>

          <dt id="lbl-priority" className="text-[13px] text-muted-foreground">
            Prioridade
          </dt>
          <dd>
            <Select value={task.priority} onValueChange={(v) => update({ priority: v as TaskPriority })}>
              <SelectTrigger aria-labelledby="lbl-priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {priorityBadge[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </dd>

          <dt id="lbl-type" className="text-[13px] text-muted-foreground">
            Tipo
          </dt>
          <dd>
            <Select value={task.type} onValueChange={(v) => update({ type: v as (typeof TYPES)[number] })}>
              <SelectTrigger aria-labelledby="lbl-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {typeLabel[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </dd>

          <dt id="lbl-assignee" className="text-[13px] text-muted-foreground">
            Responsável
          </dt>
          <dd>
            <Select
              value={task.assignee?.id ?? NONE}
              onValueChange={(v) => update({ assigneeId: v === NONE ? null : v })}
            >
              <SelectTrigger aria-labelledby="lbl-assignee" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem responsável</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <UserAvatar name={m.name} image={m.image} size="sm" />
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </dd>

          <dt className="text-[13px] text-muted-foreground">Relator</dt>
          <dd className="flex min-h-9 items-center gap-2">
            {task.reporter ? (
              <>
                <UserAvatar name={task.reporter.name} image={task.reporter.image} size="sm" />
                {task.reporter.name}
              </>
            ) : (
              <span className="text-muted-foreground">Conta removida</span>
            )}
          </dd>

          <dt id="lbl-sprint" className="text-[13px] text-muted-foreground">
            Sprint
          </dt>
          <dd>
            <Select
              value={task.sprint?.id ?? NONE}
              onValueChange={(v) => update({ sprintId: v === NONE ? null : v })}
            >
              <SelectTrigger aria-labelledby="lbl-sprint" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem sprint (backlog)</SelectItem>
                {assignableSprints.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </dd>

          <dt className="text-[13px] text-muted-foreground">
            <label htmlFor="task-points">Story points</label>
          </dt>
          <dd>
            <Input
              id="task-points"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              defaultValue={task.storyPoints ?? ""}
              className="max-w-28"
              onBlur={(e) => {
                const v = e.target.value.trim();
                const next = v === "" ? null : Number(v);
                if (next !== task.storyPoints) update({ storyPoints: next });
              }}
            />
          </dd>

          <dt className="text-[13px] text-muted-foreground">
            <label htmlFor="task-due">Prazo</label>
          </dt>
          <dd>
            <Input
              id="task-due"
              type="date"
              defaultValue={task.dueDate?.slice(0, 10) ?? ""}
              className="max-w-44"
              onChange={(e) => update({ dueDate: e.target.value || null })}
            />
          </dd>
        </dl>

        <section className="flex flex-col gap-2" aria-labelledby="sec-description">
          <h3 id="sec-description" className="text-sm font-semibold">
            Descrição
          </h3>
          <Textarea
            aria-labelledby="sec-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Contexto, critérios de aceite, links…"
          />
          {description !== task.description && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => update({ description })} disabled={pending}>
                Salvar descrição
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDescription(task.description)}>
                Descartar
              </Button>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2.5" aria-labelledby="sec-subtasks">
          <h3 id="sec-subtasks" className="text-sm font-semibold">
            Subtarefas{" "}
            <span className="font-medium text-muted-foreground">
              {doneCount}/{task.subtasks.length}
            </span>
          </h3>
          {task.subtasks.length > 0 && (
            <div
              className="h-1.5 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-label="Subtarefas concluídas"
              aria-valuenow={doneCount}
              aria-valuemin={0}
              aria-valuemax={task.subtasks.length}
            >
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(doneCount / task.subtasks.length) * 100}%` }}
              />
            </div>
          )}
          <ul className="flex flex-col">
            {task.subtasks.map((s) => (
              <li key={s.id} className="group flex min-h-9 items-center gap-2.5">
                <Checkbox
                  id={`sub-${s.id}`}
                  checked={s.isCompleted}
                  onCheckedChange={() => run(() => toggleSubtaskAction({ taskId: task.id, subtaskId: s.id }))}
                />
                <label
                  htmlFor={`sub-${s.id}`}
                  className={
                    s.isCompleted ? "flex-1 text-sm text-muted-foreground line-through" : "flex-1 text-sm"
                  }
                >
                  {s.title}
                </label>
                {s.generatedByAi && <Badge variant="muted">IA</Badge>}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover subtarefa ${s.title}`}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => run(() => deleteSubtaskAction({ taskId: task.id, subtaskId: s.id }))}
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newSubtask.trim()) return;
              run(
                () => addSubtaskAction({ taskId: task.id, title: newSubtask }),
                () => setNewSubtask("")
              );
            }}
          >
            <label htmlFor="new-subtask" className="sr-only">
              Nova subtarefa
            </label>
            <Input
              id="new-subtask"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              placeholder="Adicionar subtarefa"
            />
            <Button type="submit" variant="outline" disabled={!newSubtask.trim() || pending}>
              Adicionar
            </Button>
          </form>
        </section>

        <section className="flex flex-col gap-3.5" aria-labelledby="sec-comments">
          <h3 id="sec-comments" className="text-sm font-semibold">
            Comentários
          </h3>
          {task.comments.map((c) => (
            <div key={c.id} className="group flex gap-2.5">
              <UserAvatar name={c.author?.name ?? "?"} image={c.author?.image} />
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.author?.name ?? "Conta removida"}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                  {(c.author?.id === currentUser.id || currentUser.role !== "MEMBER") && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Excluir comentário"
                      className="ml-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => run(() => deleteCommentAction({ taskId: task.id, commentId: c.id }))}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))}
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!comment.trim()) return;
              run(
                () => addCommentAction({ taskId: task.id, content: comment }),
                () => setComment("")
              );
            }}
          >
            <label htmlFor="new-comment" className="sr-only">
              Novo comentário
            </label>
            <Textarea
              id="new-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Escreva um comentário…"
            />
            <div>
              <Button type="submit" size="sm" disabled={!comment.trim() || pending}>
                Comentar
              </Button>
            </div>
          </form>
        </section>

        <Separator />

        <section className="flex flex-col gap-2" aria-labelledby="sec-history">
          <h3 id="sec-history" className="text-sm font-semibold">
            Histórico
          </h3>
          {task.history.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Nenhuma alteração registrada.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
              {task.history.map((h) => (
                <li key={h.id}>
                  <span className="font-medium text-text-secondary">{h.user?.name ?? "Alguém"}</span>{" "}
                  {describeHistory(h)} esta tarefa · {timeAgo(h.createdAt)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {task.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              “{task.title}” será excluída com as subtarefas e os comentários. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                run(
                  () => deleteTaskAction({ taskId: task.id }),
                  () => {
                    toast.success(`${task.code} excluída.`);
                    router.replace(boardUrl);
                  }
                )
              }
            >
              Excluir tarefa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
