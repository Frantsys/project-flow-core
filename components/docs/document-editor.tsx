"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Ellipsis, FilePlus, Trash2 } from "lucide-react";
import { deleteDocumentAction, updateDocumentAction } from "@/server/actions/document.actions";
import { timeAgo } from "@/lib/history-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
import { NewDocumentButton } from "./new-document-button";
import type { DocumentDTO } from "@/server/db/types";

interface DocumentEditorProps {
  doc: DocumentDTO;
  workspace: { id: string; slug: string };
  ancestors: { id: string; title: string }[];
  childCount: number;
}

/**
 * Editor de documento em texto (Markdown). Salva com o botão ou Ctrl+S, e avisa antes de sair
 * com alterações não salvas.
 */
export function DocumentEditor({ doc, workspace, ancestors, childCount }: DocumentEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);
  const [savedAt, setSavedAt] = useState(doc.updatedAt);
  const [saved, setSaved] = useState({ title: doc.title, content: doc.content });
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // versão que outra pessoa salvou enquanto esta estava aberta
  const [conflict, setConflict] = useState<{ title: string; content: string; updatedAt: string } | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  const dirty = title !== saved.title || content !== saved.content;

  function save(baseUpdatedAt = savedAt) {
    if (!dirty || pending) return;
    startTransition(async () => {
      const result = await updateDocumentAction({
        documentId: doc.id,
        title: title.trim() || "Sem título",
        content,
        baseUpdatedAt,
      });
      if (!result.success) {
        setError(result.fieldErrors?.title?.[0] ?? result.error);
        return;
      }
      if (!result.data.saved) {
        setConflict(result.data.current);
        return;
      }
      setError(undefined);
      setSaved({ title: title.trim() || "Sem título", content });
      setSavedAt(result.data.updatedAt);
      router.refresh(); // atualiza o título na árvore
    });
  }

  // Ctrl+S / Cmd+S salva; e o navegador avisa se a pessoa fechar com alterações pendentes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  });

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-6 py-2.5 text-[13px] text-muted-foreground">
        <Breadcrumb>
          <BreadcrumbList>
            {ancestors.map((a) => (
              <Fragment key={a.id}>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href={`/w/${workspace.slug}/docs/${a.id}`}>{a.title}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </Fragment>
            ))}
            <BreadcrumbItem>
              <BreadcrumbPage>{saved.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <span className="flex-1" />
        <span role="status" className="inline-flex items-center gap-1">
          {pending ? (
            <>
              <Spinner /> Salvando…
            </>
          ) : dirty ? (
            "Alterações não salvas"
          ) : (
            <>
              <Check aria-hidden="true" className="size-4 text-success-fg" />
              <span className="text-success-fg">Salvo</span> ·{" "}
              {doc.author ? `criado por ${doc.author.name} · ` : ""}editado {timeAgo(savedAt)}
            </>
          )}
        </span>
        <Button size="sm" onClick={() => save()} disabled={!dirty || pending}>
          Salvar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Mais ações">
              <Ellipsis aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <NewDocumentButton
                workspaceId={workspace.id}
                workspaceSlug={workspace.slug}
                parentId={doc.id}
                variant="ghost"
                className="h-8 w-full justify-start px-1.5 font-normal"
              >
                <FilePlus aria-hidden="true" />
                Novo subdocumento
              </NewDocumentButton>
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden="true" />
              Excluir documento
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <article className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-4 px-6 py-10">
        <label htmlFor="doc-title" className="sr-only">
          Título
        </label>
        <Input
          id="doc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={150}
          aria-invalid={!!error}
          className="h-auto border-transparent px-1 text-[34px] font-bold tracking-tight shadow-none hover:border-input md:text-[34px]"
        />
        {error && (
          <p role="alert" className="text-[13px] text-destructive-text">
            {error}
          </p>
        )}
        <label htmlFor="doc-content" className="sr-only">
          Conteúdo
        </label>
        <Textarea
          id="doc-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva aqui. Markdown é aceito: # títulos, - listas, **negrito**."
          className="min-h-[60svh] flex-1 resize-none border-transparent px-1 text-[15px] leading-relaxed shadow-none focus-visible:border-input"
        />
      </article>

      <AlertDialog open={!!conflict} onOpenChange={(open) => !open && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alguém editou este documento</AlertDialogTitle>
            <AlertDialogDescription>
              Outra pessoa salvou uma versão {conflict ? timeAgo(conflict.updatedAt) : ""}, depois que você
              abriu o documento. Escolha qual versão fica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={async () => {
                if (!conflict) return;
                // a sua versão não se perde: vai para a área de transferência
                await navigator.clipboard?.writeText(content).catch(() => {});
                setTitle(conflict.title);
                setContent(conflict.content);
                setSaved({ title: conflict.title, content: conflict.content });
                setSavedAt(conflict.updatedAt);
                setConflict(null);
                toast.info("Carregamos a versão mais recente. O seu texto foi copiado.");
              }}
            >
              Usar a versão mais recente
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const base = conflict?.updatedAt;
                setConflict(null);
                if (base) save(base);
              }}
            >
              Manter a minha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{saved.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {childCount > 0
                ? `Os ${childCount} subdocumentos abaixo dele também serão excluídos. Não é possível desfazer.`
                : "Não é possível desfazer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteDocumentAction({ documentId: doc.id });
                  if (!result.success) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Documento excluído.");
                  const parent = ancestors.at(-1);
                  router.replace(
                    parent ? `/w/${workspace.slug}/docs/${parent.id}` : `/w/${workspace.slug}/docs`
                  );
                  router.refresh();
                })
              }
            >
              Excluir documento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
