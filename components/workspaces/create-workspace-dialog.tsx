"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createWorkspaceAction } from "@/server/actions/workspace.actions";
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

export function CreateWorkspaceDialog({ trigger }: { trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    setPending(true);
    const result = await createWorkspaceAction({ name });
    setPending(false);

    if (!result.success) {
      setError(result.fieldErrors?.name?.[0] ?? result.error);
      return;
    }

    setOpen(false);
    toast.success(`Workspace “${name.trim()}” criado.`);
    router.push(`/w/${result.data.slug}`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(undefined);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <DialogHeader>
              <DialogTitle>Novo workspace</DialogTitle>
              <DialogDescription>O endereço é gerado a partir do nome.</DialogDescription>
            </DialogHeader>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="ws-name">Nome</FieldLabel>
              <Input
                id="ws-name"
                name="name"
                placeholder="Ex.: Acme Labs"
                required
                autoFocus
                aria-invalid={!!error}
              />
              <FieldError>{error}</FieldError>
            </Field>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending && <Spinner />}
                {pending ? "Criando…" : "Criar workspace"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
