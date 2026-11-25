"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteWorkspaceAction, updateWorkspaceAction } from "@/server/actions/workspace.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
}

export function RenameWorkspaceForm({ workspace }: { workspace: WorkspaceInfo }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    setPending(true);
    const result = await updateWorkspaceAction({ workspaceId: workspace.id, name });
    setPending(false);

    if (!result.success) {
      setError(result.fieldErrors?.name?.[0] ?? result.error);
      return;
    }
    setError(undefined);
    toast.success("Alterações salvas.");
    router.refresh();
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="flex flex-col gap-(--card-spacing)">
        <CardHeader>
          <CardTitle className="font-semibold">Geral</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="max-w-md">
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="ws-name">Nome do workspace</FieldLabel>
              <Input id="ws-name" name="name" defaultValue={workspace.name} required aria-invalid={!!error} />
              <FieldError>{error}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="ws-slug">Endereço</FieldLabel>
              <Input id="ws-slug" value={workspace.slug} readOnly disabled />
              <FieldDescription>O endereço é fixo para não quebrar links já compartilhados.</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="border-t pb-(--card-spacing)">
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />}
            {pending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export function DeleteWorkspaceCard({
  workspace,
  projectsCount,
  membersCount,
}: {
  workspace: WorkspaceInfo;
  projectsCount: number;
  membersCount: number;
}) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const confirmed = typed === workspace.slug;

  async function onDelete(event: React.MouseEvent) {
    event.preventDefault(); // mantém o diálogo aberto enquanto a exclusão roda
    setPending(true);
    const result = await deleteWorkspaceAction({ workspaceId: workspace.id });
    setPending(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Workspace “${workspace.name}” excluído.`);
    router.push("/workspaces");
  }

  return (
    <Card className="border-destructive-border">
      <CardHeader>
        <CardTitle className="font-semibold text-danger-fg">Excluir workspace</CardTitle>
        <CardDescription>
          Remove projetos, tarefas e documentos. Não pode ser desfeito. Só o dono do workspace pode excluir.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <AlertDialog onOpenChange={(open) => !open && setTyped("")}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Excluir workspace</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir o workspace {workspace.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                {projectsCount === 1 ? "O projeto" : `Os ${projectsCount} projetos`}, com tarefas, sprints e
                documentos, serão excluídos.{" "}
                {membersCount === 1 ? "Você perde" : `Os ${membersCount} membros perdem`} o acesso. Não é
                possível desfazer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Field>
              <FieldLabel htmlFor="confirm-slug">
                Digite <span className="font-mono">{workspace.slug}</span> para confirmar
              </FieldLabel>
              <Input
                id="confirm-slug"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            </Field>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={!confirmed || pending} onClick={onDelete}>
                {pending && <Spinner />}
                Excluir workspace
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
