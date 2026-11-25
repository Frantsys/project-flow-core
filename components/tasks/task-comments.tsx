"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AtSign, Pencil, Trash2 } from "lucide-react";
import { addCommentAction, deleteCommentAction, editCommentAction } from "@/server/actions/task.actions";
import { parseMentions, type MentionMember } from "@/lib/mentions";
import { timeAgo } from "@/lib/history-format";
import { can } from "@/lib/permissions";
import type { CommentDTO } from "@/server/db/types";
import type { WorkspaceRole } from "@/server/db/models";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";

type Result = { success: true } | { success: false; error: string };

/** Texto do comentário com os @Nome de membros destacados. */
function CommentText({ content, members }: { content: string; members: MentionMember[] }) {
  const { parts } = parseMentions(content, members);
  return (
    <p className="leading-relaxed whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.memberId ? (
          <span key={i} className="rounded-sm bg-info-bg px-0.5 font-medium text-info-fg">
            {p.text}
          </span>
        ) : (
          p.text
        )
      )}
    </p>
  );
}

/** Campo de texto com o botão "Mencionar", que insere @Nome onde está o cursor. */
function CommentEditor({
  id,
  value,
  onChange,
  members,
  label,
  autoFocus = false,
}: {
  autoFocus?: boolean;
  id: string;
  value: string;
  onChange: (v: string) => void;
  members: MentionMember[];
  label: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // posição do cursor depois da menção: o menu devolve o foco ao campo quando fecha
  const caret = useRef<number | null>(null);

  function insert(name: string) {
    const el = ref.current;
    const at = el?.selectionStart ?? value.length;
    const before = value.slice(0, at);
    const spacer = before && !/\s$/.test(before) ? " " : "";
    const text = `${spacer}@${name} `;
    onChange(before + text + value.slice(at));
    caret.current = at + text.length;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Textarea
        ref={ref}
        id={id}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Escreva um comentário… use @Nome para avisar alguém"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="self-start text-muted-foreground">
            <AtSign aria-hidden="true" />
            Mencionar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-64 overflow-y-auto"
          onCloseAutoFocus={(e) => {
            if (caret.current === null) return;
            e.preventDefault();
            ref.current?.focus();
            ref.current?.setSelectionRange(caret.current, caret.current);
            caret.current = null;
          }}
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Avisar alguém do time
          </DropdownMenuLabel>
          {members.map((m) => (
            <DropdownMenuItem key={m.id} onSelect={() => insert(m.name)}>
              {m.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function TaskComments({
  taskId,
  comments,
  members,
  currentUser,
}: {
  taskId: string;
  comments: CommentDTO[];
  members: MentionMember[];
  currentUser: { id: string; role: WorkspaceRole };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);

  function run(action: () => Promise<Result>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) return void toast.error(result.error);
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3.5" aria-labelledby="sec-comments">
      <h3 id="sec-comments" className="text-sm font-semibold">
        Comentários
      </h3>
      {comments.map((c) => {
        const mine = c.author?.id === currentUser.id;
        const isEditing = editing?.id === c.id;
        return (
          <div key={c.id} className="group flex gap-2.5">
            <UserAvatar name={c.author?.name ?? "?"} image={c.author?.image} />
            <div className="min-w-0 flex-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.author?.name ?? "Conta removida"}</span>
                <span className="text-xs text-muted-foreground">
                  {timeAgo(c.createdAt)}
                  {c.editedAt && " · editado"}
                </span>
                <span className="ml-auto flex opacity-0 group-hover:opacity-100 has-[:focus-visible]:opacity-100">
                  {mine && !isEditing && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Editar comentário"
                      onClick={() => setEditing({ id: c.id, content: c.content })}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                  )}
                  {(mine || can(currentUser.role, "comment.deleteAny")) && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Excluir comentário"
                      onClick={() => run(() => deleteCommentAction({ taskId, commentId: c.id }))}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </span>
              </div>
              {isEditing ? (
                <form
                  className="mt-1 flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!editing.content.trim()) return;
                    run(
                      () => editCommentAction({ taskId, commentId: c.id, content: editing.content }),
                      () => setEditing(null)
                    );
                  }}
                >
                  <CommentEditor
                    id={`edit-${c.id}`}
                    label="Editar comentário"
                    autoFocus
                    value={editing.content}
                    onChange={(content) => setEditing({ id: c.id, content })}
                    members={members}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={!editing.content.trim() || pending}>
                      Salvar
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <CommentText content={c.content} members={members} />
              )}
            </div>
          </div>
        );
      })}
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          run(
            () => addCommentAction({ taskId, content: draft }),
            () => setDraft("")
          );
        }}
      >
        <CommentEditor
          id="new-comment"
          label="Novo comentário"
          value={draft}
          onChange={setDraft}
          members={members}
        />
        <div>
          <Button type="submit" size="sm" disabled={!draft.trim() || pending}>
            Comentar
          </Button>
        </div>
      </form>
    </section>
  );
}
