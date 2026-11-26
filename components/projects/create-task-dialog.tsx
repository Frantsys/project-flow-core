"use client";

import { DateField } from "@/components/date-field";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createTaskAction } from "@/server/actions/task.actions";
import { priorityBadge, typeLabel } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { StatusDTO, TaskPriority } from "@/server/db/types";

const TYPES = ["TASK", "BUG", "STORY"] as const;
const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

type Errors = Partial<Record<"title" | "statusId" | "storyPoints" | "dueDate", string>>;

export function CreateTaskDialog({
  projectId,
  statuses,
  defaultStatusId,
  trigger,
}: {
  projectId: string;
  statuses: StatusDTO[];
  defaultStatusId?: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const points = String(data.get("storyPoints") ?? "").trim();
    const due = String(data.get("dueDate") ?? "");

    setPending(true);
    const result = await createTaskAction({
      projectId,
      title: String(data.get("title") ?? ""),
      type: data.get("type") as (typeof TYPES)[number],
      priority: data.get("priority") as TaskPriority,
      statusId: String(data.get("statusId") ?? "") || undefined,
      storyPoints: points === "" ? null : Number(points),
      dueDate: due === "" ? null : due,
    });
    setPending(false);

    if (!result.success) {
      const fe = result.fieldErrors ?? {};
      setErrors({
        title: fe.title?.[0],
        statusId: fe.statusId?.[0],
        storyPoints: fe.storyPoints?.[0],
        dueDate: fe.dueDate?.[0],
      });
      setFormError(result.fieldErrors ? undefined : result.error);
      return;
    }

    setOpen(false);
    toast.success(`Tarefa ${result.data.code} criada.`);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setErrors({});
          setFormError(undefined);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <DialogHeader>
              <DialogTitle>Nova tarefa</DialogTitle>
              <DialogDescription>O código da tarefa é gerado ao salvar.</DialogDescription>
            </DialogHeader>

            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="task-title">Título</FieldLabel>
              <Input
                id="task-title"
                name="title"
                placeholder="Ex.: Erro ao salvar projeto sem descrição"
                required
                autoFocus
                aria-invalid={!!errors.title}
              />
              <FieldError>{errors.title}</FieldError>
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="task-type">Tipo</FieldLabel>
                <Select name="type" defaultValue="TASK">
                  <SelectTrigger id="task-type" className="w-full">
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
              </Field>
              <Field>
                <FieldLabel htmlFor="task-priority">Prioridade</FieldLabel>
                <Select name="priority" defaultValue="MEDIUM">
                  <SelectTrigger id="task-priority" className="w-full">
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
              </Field>
              <Field data-invalid={!!errors.statusId}>
                <FieldLabel htmlFor="task-status">Status</FieldLabel>
                <Select
                  name="statusId"
                  defaultValue={
                    defaultStatusId ?? (statuses.find((s) => s.category === "TODO") ?? statuses[0])?.id
                  }
                >
                  <SelectTrigger id="task-status" className="w-full" aria-invalid={!!errors.statusId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>{errors.statusId}</FieldError>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.storyPoints}>
                <FieldLabel htmlFor="task-points">Story points (opcional)</FieldLabel>
                <Input
                  id="task-points"
                  name="storyPoints"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  aria-invalid={!!errors.storyPoints}
                />
                <FieldError>{errors.storyPoints}</FieldError>
              </Field>
              <Field data-invalid={!!errors.dueDate}>
                <FieldLabel htmlFor="task-due">Prazo (opcional)</FieldLabel>
                <DateField
                  id="task-due"
                  name="dueDate"
                  label="Prazo"
                  placeholder="Sem prazo"
                  invalid={!!errors.dueDate}
                />
                <FieldError>{errors.dueDate}</FieldError>
              </Field>
            </div>

            <FieldError>{formError}</FieldError>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending && <Spinner />}
                {pending ? "Criando…" : "Criar tarefa"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
