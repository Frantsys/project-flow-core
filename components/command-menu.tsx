"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Bell,
  Building2,
  FileText,
  FolderKanban,
  House,
  ListChecks,
  Monitor,
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
  SquareCheck,
  UserRound,
  Keyboard,
  Trash2,
} from "lucide-react";
import { searchAction } from "@/server/actions/search.actions";
import { normalizeText } from "@/lib/task-filters";
import type { SearchResultDTO } from "@/server/services/search.service";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const OPEN_EVENT = "project-flow:open-command-menu";

/** Abre a paleta de qualquer lugar (botões de busca). */
export const openCommandMenu = () => window.dispatchEvent(new Event(OPEN_EVENT));
export const SHORTCUTS_EVENT = "pf:open-shortcuts";
const openShortcuts = () => window.dispatchEvent(new Event(SHORTCUTS_EVENT));

const KIND = {
  task: { label: "Tarefas", icon: SquareCheck },
  project: { label: "Projetos", icon: FolderKanban },
  document: { label: "Documentos", icon: FileText },
  workspace: { label: "Workspaces", icon: Building2 },
} as const;

export const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/**
 * Paleta de comandos (Ctrl K ou /): busca tarefas, projetos e documentos de todos os workspaces,
 * navega para as telas principais e troca o tema.
 */
export function CommandMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const disabled = pathname.startsWith("/auth");
  const workspaceSlug = /^\/w\/([^/]+)/.exec(pathname)?.[1];

  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "/" && !isTyping(e.target))
      ) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, [disabled]);

  // busca no servidor depois de uma pausa na digitação; descarta respostas antigas
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let stale = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await searchAction({ q });
      if (stale) return;
      setLoading(false);
      setResults(result.success ? result.data : []);
    }, 200);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query]);

  if (disabled) return null;

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const base = workspaceSlug ? `/w/${workspaceSlug}` : null;
  const commands = [
    ...(base
      ? [
          { label: "Visão geral do workspace", icon: House, action: () => go(base) },
          { label: "Documentos", icon: FileText, action: () => go(`${base}/docs`) },
          {
            label: "Configurações do workspace",
            icon: SlidersHorizontal,
            action: () => go(`${base}/settings`),
          },
          { label: "Lixeira", icon: Trash2, action: () => go(`${base}/trash`) },
          { label: "Atalhos de teclado", icon: Keyboard, action: () => run(openShortcuts) },
        ]
      : []),
    { label: "Minhas tarefas", icon: ListChecks, action: () => go("/my-work") },
    { label: "Notificações", icon: Bell, action: () => go("/inbox") },
    { label: "Todos os workspaces", icon: Building2, action: () => go("/workspaces") },
    { label: "Minha conta", icon: UserRound, action: () => go("/account") },
    { label: "Tema claro", icon: Sun, action: () => run(() => setTheme("light")) },
    { label: "Tema escuro", icon: Moon, action: () => run(() => setTheme("dark")) },
    { label: "Tema do sistema", icon: Monitor, action: () => run(() => setTheme("system")) },
  ].filter((c) => !query || normalizeText(c.label).includes(normalizeText(query)));

  const searching = query.trim().length >= 2;
  const shown = searching ? results : [];

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setResults([]);
        }
      }}
      title="Buscar ou ir para"
      description="Busque tarefas, projetos e documentos, ou escolha um comando."
    >
      {/* a busca já vem filtrada do servidor (sem acento, sem maiúscula): o cmdk não filtra de novo */}
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Buscar tarefas, projetos, documentos…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {loading ? "Buscando…" : searching ? "Nada encontrado." : "Digite para buscar."}
          </CommandEmpty>
          {(Object.keys(KIND) as (keyof typeof KIND)[]).map((kind) => {
            const items = shown.filter((r) => r.kind === kind);
            if (items.length === 0) return null;
            const { label, icon: Icon } = KIND[kind];
            return (
              <CommandGroup key={kind} heading={label}>
                {items.map((r) => (
                  <CommandItem key={r.id} value={`${kind}-${r.id}`} onSelect={() => go(r.href)}>
                    <Icon aria-hidden="true" />
                    <span className="truncate">{r.title}</span>
                    <span className="ml-auto truncate text-xs text-muted-foreground">{r.hint}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
          {shown.length > 0 && commands.length > 0 && <CommandSeparator />}
          {commands.length > 0 && (
            <CommandGroup heading="Comandos">
              {commands.map((c) => (
                <CommandItem key={c.label} value={c.label} onSelect={c.action}>
                  <c.icon aria-hidden="true" />
                  {c.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {loading && (
            <div className="flex justify-center py-2" aria-hidden="true">
              <Spinner className="text-muted-foreground" />
            </div>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

/** Botão visível que abre a paleta, com o atalho ao lado. */
export function CommandMenuButton({ className }: { className?: string }) {
  return (
    <Button variant="outline" className={className} onClick={openCommandMenu}>
      <Search aria-hidden="true" />
      <span className="flex-1 text-left font-normal text-muted-foreground">Buscar…</span>
      <CommandShortcut className="ml-2">Ctrl K</CommandShortcut>
    </Button>
  );
}
