"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSprintAction } from "@/server/actions/sprint.actions";
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

export function CreateSprintDialog({
  projectId,
  suggestedName,
  trigger,
}: {
  projectId: string;
  suggestedName: string;
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
    setPending(true);
    const result = await createSprintAction({
      projectId,
      name: String(data.get("name") ?? ""),
      goal: String(data.get("goal") ?? ""),
      startDate: String(data.get("startDate") ?? "") || null,
      endDate: String(data.get("endDate") ?? "") || null,
    });
    setPending(false);

    if (!result.success) {
      const fe = result.fieldErrors ?? {};
      setErrors({ name: fe.name?.[0], goal: fe.goal?.[0], startDate: fe.startDate?.[0], endDate: fe.endDate?.[0] });
      setFormError(result.fieldErrors ? undefined : result.error);
      return;
    }
    setOpen(false);
    toast.success("Sprint criada.");
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
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <DialogHeader>
              <DialogTitle>Nova sprint</DialogTitle>
              <DialogDescription>Planeje agora e inicie quando o time estiver pronto.</DialogDescription>
            </DialogHeader>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="sprint-name">Nome</FieldLabel>
              <Input id="sprint-name" name="name" defaultValue={suggestedName} required autoFocus aria-invalid={!!errors.name} />
              <FieldError>{errors.name}</FieldError>
            </Field>
            <Field data-invalid={!!errors.goal}>
              <FieldLabel htmlFor="sprint-goal">Meta (opcional)</FieldLabel>
              <Input id="sprint-goal" name="goal" placeholder="O que o time quer entregar" aria-invalid={!!errors.goal} />
              <FieldError>{errors.goal}</FieldError>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.startDate}>
                <FieldLabel htmlFor="sprint-start">Início (opcional)</FieldLabel>
                <Input id="sprint-start" name="startDate" type="date" aria-invalid={!!errors.startDate} />
                <FieldError>{errors.startDate}</FieldError>
              </Field>
              <Field data-invalid={!!errors.endDate}>
                <FieldLabel htmlFor="sprint-end">Fim (opcional)</FieldLabel>
                <Input id="sprint-end" name="endDate" type="date" aria-invalid={!!errors.endDate} />
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
                {pending ? "Criando…" : "Criar sprint"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
