"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createProjectAction } from "@/server/actions/project.actions";
import { suggestKey } from "@/lib/project-key";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
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

type Errors = Partial<Record<"name" | "key" | "description", string>>;

export function CreateProjectDialog({
  workspaceId,
  workspaceSlug,
  trigger,
}: {
  workspaceId: string;
  workspaceSlug: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    const result = await createProjectAction({
      workspaceId,
      name: String(data.get("name") ?? ""),
      key: String(data.get("key") ?? ""),
      description: String(data.get("description") ?? "") || undefined,
    });
    setPending(false);

    if (!result.success) {
      const fe = result.fieldErrors ?? {};
      setErrors({ name: fe.name?.[0], key: fe.key?.[0], description: fe.description?.[0] });
      setFormError(result.fieldErrors ? undefined : result.error);
      return;
    }

    setOpen(false);
    toast.success(`Projeto “${result.data.name}” criado.`);
    router.push(`/w/${workspaceSlug}/projects/${result.data.key}`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setErrors({});
          setFormError(undefined);
          setKey("");
          setKeyTouched(false);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <DialogHeader>
              <DialogTitle>Novo projeto</DialogTitle>
              <DialogDescription>A chave aparece no código das tarefas, como PF-12.</DialogDescription>
            </DialogHeader>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="project-name">Nome</FieldLabel>
              <Input
                id="project-name"
                name="name"
                placeholder="Ex.: Site institucional"
                required
                autoFocus
                aria-invalid={!!errors.name}
                onChange={(e) => !keyTouched && setKey(suggestKey(e.target.value))}
              />
              <FieldError>{errors.name}</FieldError>
            </Field>
            <Field data-invalid={!!errors.key}>
              <FieldLabel htmlFor="project-key">Chave</FieldLabel>
              <Input
                id="project-key"
                name="key"
                value={key}
                maxLength={10}
                className="max-w-40 uppercase"
                aria-invalid={!!errors.key}
                onChange={(e) => {
                  setKeyTouched(true);
                  setKey(e.target.value.toUpperCase());
                }}
              />
              {errors.key ? (
                <FieldError>{errors.key}</FieldError>
              ) : (
                <FieldDescription>De 2 a 10 letras ou números, começando por letra.</FieldDescription>
              )}
            </Field>
            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="project-description">Descrição (opcional)</FieldLabel>
              <Textarea id="project-description" name="description" rows={3} maxLength={500} />
              <FieldError>{errors.description}</FieldError>
            </Field>
            <FieldError>{formError}</FieldError>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending && <Spinner />}
                {pending ? "Criando…" : "Criar projeto"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
