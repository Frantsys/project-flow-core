"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, SendHorizontal, Trash2, X } from "lucide-react";
import { askBuddyAction } from "@/server/actions/buddy.actions";
import type { ChatMessage } from "@/server/lib/ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Markdown } from "@/components/markdown";

const STORAGE_KEY = "pf-buddy";
const HISTORY = 12;

/** Sugestões que mudam com a tela, para a pessoa não começar do zero. */
function suggestionsFor(pathname: string) {
  if (/\/tasks\/[^/]+$/.test(pathname))
    return [
      "O que falta para concluir esta tarefa?",
      "Escreva critérios de aceite",
      "Quebre em passos menores",
    ];
  if (pathname.endsWith("/backlog"))
    return ["Como está a sprint ativa?", "O que priorizar na próxima sprint?", "Tem tarefa sem responsável?"];
  if (pathname.endsWith("/reports")) return ["Resuma o andamento do projeto", "Quem está sobrecarregado?"];
  if (/\/projects\/[^/]+/.test(pathname))
    return ["O que está atrasado?", "O que está travado no quadro?", "Resuma o projeto em 3 frases"];
  if (/\/docs\/[^/]+$/.test(pathname)) return ["Revise este documento", "Sugira um sumário"];
  return ["O que eu faço hoje?", "Como está o workspace?", "Como funcionam as sprints aqui?"];
}

function loadConversation(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

/**
 * Assistente que fica na tela enquanto a pessoa trabalha: um painel flutuante, sem bloquear a
 * página, que sabe em que tela ela está (a cada pergunta o servidor monta o contexto de novo).
 * A conversa continua ao trocar de tela e fica guardada nesta aba (sessionStorage).
 */
export function Buddy() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // o painel começa fechado e a conversa só aparece aberta: ler aqui não muda a hidratação
  const [messages, setMessages] = useState<ChatMessage[]>(loadConversation);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setDraft("");
    setError(null);
    setPending(true);
    const result = await askBuddyAction({ pathname, messages: next.slice(-HISTORY) });
    setPending(false);
    if (!result.success) {
      // a pergunta volta para o campo: dá para tentar de novo sem perguntas sem resposta na conversa
      setMessages(messages);
      setDraft(content);
      setError(result.error);
      return;
    }
    setMessages([...next, { role: "assistant", content: result.data.reply }]);
  }

  if (!open) {
    return (
      <Button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 h-11 gap-2 rounded-full px-4 shadow-lg"
        style={{ viewTransitionName: "buddy" }}
        aria-label="Abrir o assistente"
      >
        <Sparkles aria-hidden="true" />
        <span className="hidden sm:inline">Assistente</span>
      </Button>
    );
  }

  return (
    <section
      aria-label="Assistente"
      style={{ viewTransitionName: "buddy" }}
      onKeyDown={(e) => e.key === "Escape" && close()}
      className="fixed inset-x-2 bottom-2 z-40 flex max-h-[min(640px,calc(100dvh-1rem))] flex-col rounded-xl border bg-popover text-popover-foreground shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[400px]"
    >
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        <h2 className="flex-1 text-sm font-semibold">Assistente</h2>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
            aria-label="Limpar a conversa"
            title="Limpar a conversa"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Fechar o assistente">
          <X aria-hidden="true" />
        </Button>
      </header>

      <div
        ref={listRef}
        className="flex min-h-40 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Estou vendo a mesma tela que você. Pergunte sobre as tarefas, a sprint ou peça ajuda para escrever
            algo.
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <p
              key={i}
              className="ml-8 self-end rounded-lg bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground"
            >
              {m.content}
            </p>
          ) : (
            <div
              key={i}
              className="mr-4 rounded-lg bg-muted px-3 py-1 text-sm [&_*]:text-sm [&_p]:my-2 [&_p]:leading-6"
            >
              <Markdown>{m.content}</Markdown>
            </div>
          )
        )}
        {pending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Pensando…
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {suggestionsFor(pathname).map((s) => (
            <Button
              key={s}
              variant="outline"
              size="sm"
              className="h-auto py-1 text-xs"
              onClick={() => send(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      )}

      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <Textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
          placeholder="Pergunte algo… (Enter envia)"
          aria-label="Mensagem para o assistente"
          maxLength={4000}
          rows={1}
          className="max-h-32 min-h-10 resize-none"
        />
        <Button type="submit" size="icon" disabled={pending || !draft.trim()} aria-label="Enviar">
          <SendHorizontal aria-hidden="true" />
        </Button>
      </form>
    </section>
  );
}
