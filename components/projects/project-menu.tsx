"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { deleteProjectAction, updateProjectAction } from "@/server/actions/project.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface ProjectMenuProps {
  project: { id: string; name: string; key: string; description: string | null; taskCount: number };
  workspaceSlug: string;
}

/** Editar ou excluir o projeto. Só aparece para dono e admin. */
export function ProjectMenu({ project, workspaceSlug }: ProjectMenuProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; description?: string; form?: string }>({});
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();

  function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateProjectAction({
        projectId: project.id,
        name: String(data.get("name") ?? ""),
        description: String(data.get("description") ?? ""),
      });
      if (!result.success) {
        const fe = result.fieldErrors ?? {};
        setErrors({ name: fe.name?.[0], description: fe.description?.[0], form: result.fieldErrors ? undefined : result.error });
        return;
      }
      setErrors({});
      setEditOpen(false);
      toast.success("Projeto atualizado.");
      router.refresh();
    });
  }

  function onDelete(event: React.MouseEvent) {
    event.preventDefault(); // mantém o diálogo aberto enquanto exclui
    startTransition(async () => {
      const result = await deleteProjectAction({ projectId: project.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setDeleteOpen(false);
      toast.success(`Projeto ${project.key} excluído.`);
      router.push(`/w/${workspaceSlug}`);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Ações do projeto">
            <Ellipsis aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil aria-hidden="true" />
            Editar projeto
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden="true" />
            Excluir projeto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={onSave}>
            <FieldGroup>
              <DialogHeader>
                <DialogTitle>Editar projeto</DialogTitle>
                <DialogDescription>A chave {project.key} não muda, para não alterar o código das tarefas.</DialogDescription>
              </DialogHeader>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="edit-project-name">Nome</FieldLabel>
                <Input id="edit-project-name" name="name" defaultValue={project.name} required aria-invalid={!!errors.name} />
                <FieldError>{errors.name}</FieldError>
              </Field>
              <Field data-invalid={!!errors.description}>
                <FieldLabel htmlFor="edit-project-description">Descrição</FieldLabel>
                <Textarea
                  id="edit-project-description"
                  name="description"
                  defaultValue={project.description ?? ""}
                  rows={3}
                  maxLength={500}
                />
                <FieldError>{errors.description}</FieldError>
              </Field>
              <FieldError>{errors.form}</FieldError>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={pending}>
                  {pending && <Spinner />}
                  Salvar
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setTyped(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o projeto {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {project.taskCount === 1 ? "A tarefa" : `As ${project.taskCount} tarefas`}, as sprints e os documentos do projeto
              serão excluídos. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor="confirm-project-key">
              Digite <span className="font-mono">{project.key}</span> para confirmar
            </FieldLabel>
            <Input id="confirm-project-key" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={typed.trim().toUpperCase() !== project.key || pending} onClick={onDelete}>
              {pending && <Spinner />}
              Excluir projeto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
