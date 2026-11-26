"use client";

import { DateField } from "@/components/date-field";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSprintAction, updateSprintAction } from "@/server/actions/sprint.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
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

type Errors = Partial<Record<"name" | "goal" | "startDate" | "endDate", string>>;

/** Criar sprint ou, com `sprint`, editar uma existente (aberto de fora por `open`/`onOpenChange`). */
export function CreateSprintDialog({
  projectId,
  suggestedName,
  trigger,
  sprint,
  open: controlledOpen,
  onOpenChange,
}: {
  projectId?: string;
  suggestedName?: string;
  trigger?: React.ReactNode;
  sprint?: { id: string; name: string; goal: string; startDate: string | null; endDate: string | null };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    const fields = {
      name: String(data.get("name") ?? ""),
      goal: String(data.get("goal") ?? ""),
      startDate: String(data.get("startDate") ?? "") || null,
      endDate: String(data.get("endDate") ?? "") || null,
    };
    const result = sprint
      ? await updateSprintAction({ sprintId: sprint.id, ...fields })
      : await createSprintAction({ projectId: projectId ?? "", ...fields });
    setPending(false);

    if (!result.success) {
      const fe = result.fieldErrors ?? {};
      setErrors({
        name: fe.name?.[0],
        goal: fe.goal?.[0],
        startDate: fe.startDate?.[0],
        endDate: fe.endDate?.[0],
      });
      setFormError(result.fieldErrors ? undefined : result.error);
      return;
    }
    setOpen(false);
    toast.success(sprint ? "Sprint salva." : "Sprint criada.");
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
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <DialogHeader>
              <DialogTitle>{sprint ? "Editar sprint" : "Nova sprint"}</DialogTitle>
              <DialogDescription>
                {sprint
                  ? "Nome, meta e datas. As tarefas da sprint não mudam."
                  : "Planeje agora e inicie quando o time estiver pronto."}
              </DialogDescription>
            </DialogHeader>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="sprint-name">Nome</FieldLabel>
              <Input
                id="sprint-name"
                name="name"
                defaultValue={sprint?.name ?? suggestedName}
                required
                autoFocus
                aria-invalid={!!errors.name}
              />
              <FieldError>{errors.name}</FieldError>
            </Field>
            <Field data-invalid={!!errors.goal}>
              <FieldLabel htmlFor="sprint-goal">Meta (opcional)</FieldLabel>
              <Input
                id="sprint-goal"
                name="goal"
                defaultValue={sprint?.goal}
                placeholder="O que o time quer entregar"
                aria-invalid={!!errors.goal}
              />
              <FieldError>{errors.goal}</FieldError>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.startDate}>
                <FieldLabel htmlFor="sprint-start">Início (opcional)</FieldLabel>
                <DateField
                  id="sprint-start"
                  name="startDate"
                  label="Início"
                  defaultValue={sprint?.startDate?.slice(0, 10)}
                  invalid={!!errors.startDate}
                />
                <FieldError>{errors.startDate}</FieldError>
              </Field>
              <Field data-invalid={!!errors.endDate}>
                <FieldLabel htmlFor="sprint-end">Fim (opcional)</FieldLabel>
                <DateField
                  id="sprint-end"
                  name="endDate"
                  label="Fim"
                  defaultValue={sprint?.endDate?.slice(0, 10)}
                  invalid={!!errors.endDate}
                />
                <FieldError>{errors.endDate}</FieldError>
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
                {pending ? "Salvando…" : sprint ? "Salvar" : "Criar sprint"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
