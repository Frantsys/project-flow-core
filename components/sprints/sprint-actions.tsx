"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ellipsis, Trash2 } from "lucide-react";
import { completeSprintAction, deleteSprintAction, startSprintAction } from "@/server/actions/sprint.actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldLabel } from "@/components/ui/field";
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
import type { SprintStatus } from "@/server/db/types";

const BACKLOG = "backlog";

interface SprintActionsProps {
  sprint: { id: string; name: string; status: SprintStatus };
  /** Códigos das tarefas que não estão no último status, para o aviso ao concluir. */
  openTaskCodes: string[];
  plannedSprints: { id: string; name: string }[];
  hasActiveSprint: boolean;
}

/** Iniciar, concluir ou excluir uma sprint. Só aparece para dono e admin. */
export function SprintActions({
  sprint,
  openTaskCodes,
  plannedSprints,
  hasActiveSprint,
}: SprintActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [completeOpen, setCompleteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [destination, setDestination] = useState(plannedSprints[0]?.id ?? BACKLOG);

  function run(
    action: () => Promise<{ success: true } | { success: false; error: string }>,
    message: string
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(message);
      router.refresh();
    });
  }

  if (sprint.status === "COMPLETED") return null;

  return (
    <div className="flex items-center gap-1">
      {sprint.status === "PLANNED" && (
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || hasActiveSprint}
            title={hasActiveSprint ? "Conclua a sprint ativa antes de iniciar outra" : undefined}
            onClick={() => run(() => startSprintAction({ sprintId: sprint.id }), `${sprint.name} iniciada.`)}
          >
            {pending && <Spinner />}
            Iniciar sprint
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Mais ações de ${sprint.name}`}>
                <Ellipsis aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                <Trash2 aria-hidden="true" />
                Excluir sprint
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      {sprint.status === "ACTIVE" && (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => setCompleteOpen(true)}>
          {pending && <Spinner />}
          Concluir sprint
        </Button>
      )}

      <AlertDialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir {sprint.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {openTaskCodes.length === 0
                ? "Todas as tarefas estão concluídas."
                : `${openTaskCodes.length} ${openTaskCodes.length === 1 ? "tarefa ainda não está concluída" : "tarefas ainda não estão concluídas"} (${openTaskCodes.slice(0, 5).join(", ")}${openTaskCodes.length > 5 ? "…" : ""}). Escolha para onde elas vão.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {openTaskCodes.length > 0 && (
            <Field>
              <FieldLabel htmlFor="complete-destination">Mover tarefas abertas para</FieldLabel>
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger id="complete-destination" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plannedSprints.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} (planejada)
                    </SelectItem>
                  ))}
                  <SelectItem value={BACKLOG}>Backlog</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                run(
                  () =>
                    completeSprintAction({
                      sprintId: sprint.id,
                      moveToSprintId: destination === BACKLOG ? null : destination,
                    }),
                  `${sprint.name} concluída.`
                )
              }
            >
              Concluir sprint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {sprint.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              As tarefas desta sprint voltam para o backlog. Nenhuma tarefa é excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                run(() => deleteSprintAction({ sprintId: sprint.id }), `${sprint.name} excluída.`)
              }
            >
              Excluir sprint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
