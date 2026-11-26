"use client";

import { useEffect, useRef } from "react";
import { NAV } from "@/lib/navigation";
import { usePathname, useRouter } from "next/navigation";
import { isTyping } from "./command-menu";
import { useUiStore } from "@/store/ui-store";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** G e depois a letra: vai para a tela. As do projeto só valem dentro de um projeto. */
const toggleMyWork = () => useUiStore.getState().togglePanel("myWork");

const GO: {
  key: string;
  label: string;
  path: (base: string, project?: string) => string | null;
  /** Ação no lugar da navegação (Minhas tarefas abre um painel). */
  run?: () => void;
}[] = [
  { key: "i", label: "Visão geral do workspace", path: (b) => b },
  { key: "m", label: "Minhas tarefas (abre o painel)", path: () => null, run: () => toggleMyWork() },
  { key: "d", label: "Documentos", path: (b) => `${b}/docs` },
  { key: "q", label: "Quadro do projeto", path: (b, p) => (p ? `${b}/projects/${p}` : null) },
  { key: "b", label: "Backlog do projeto", path: (b, p) => (p ? `${b}/projects/${p}/backlog` : null) },
  { key: "l", label: "Lista do projeto", path: (b, p) => (p ? `${b}/projects/${p}/list` : null) },
  { key: "c", label: "Calendário do projeto", path: (b, p) => (p ? `${b}/projects/${p}/calendar` : null) },
];

/** Cada item: as alternativas (Ctrl K ou /), cada uma com as teclas em sequência. */
const OTHERS: { keys: string[][]; label: string }[] = [
  { keys: [["C"]], label: "Nova tarefa (no quadro e no backlog)" },
  { keys: [["Ctrl", "K"], ["/"]], label: "Buscar e abrir a paleta de comandos" },
  { keys: [["Ctrl", "S"]], label: "Salvar o documento" },
  { keys: [["?"]], label: "Mostrar estes atalhos" },
];

function Keys({ keys }: { keys: string[][] }) {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      {keys.map((group, i) => (
        <span key={i} className="contents">
          {i > 0 && "ou"}
          {group.map((k) => (
            <kbd key={k} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-foreground">
              {k}
            </kbd>
          ))}
        </span>
      ))}
    </span>
  );
}

/**
 * Primeiro elemento visível. O Next guarda as páginas visitadas escondidas na árvore (Activity),
 * então um querySelector simples acharia o botão ou o diálogo da página anterior.
 */
const visible = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)].find((el) => el.checkVisibility());

/**
 * Atalhos de uma tecla, no estilo de Linear e GitHub. Ficam desligados enquanto a pessoa digita,
 * com modificadores (Ctrl, Alt) e com um diálogo aberto, para não roubar teclas de ninguém.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const help = useUiStore((s) => s.panel === "shortcuts");
  const setPanelOpen = useUiStore((s) => s.setPanelOpen);
  const setHelp = (open: boolean) => setPanelOpen("shortcuts", open);
  const pendingG = useRef(0);

  useEffect(() => {
    const match = /^\/w\/([^/]+)(?:\/projects\/([^/]+))?/.exec(pathname);
    if (!match) return;
    const base = `/w/${match[1]}`;
    const project = match[2];

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || isTyping(e.target)) return;
      // um diálogo na animação de saída (data-state="closed") já não conta como aberto
      if (visible(':is([role="dialog"], [role="alertdialog"], [role="menu"]):not([data-state="closed"])'))
        return;
      const key = e.key.toLowerCase();

      if (Date.now() - pendingG.current < 1500) {
        pendingG.current = 0;
        const go = GO.find((g) => g.key === key);
        const to = go?.path(base, project);
        if (go?.run) {
          e.preventDefault();
          go.run();
        } else if (to) {
          e.preventDefault();
          router.push(to, { transitionTypes: NAV });
        }
        return;
      }
      if (key === "g") {
        pendingG.current = Date.now();
      } else if (e.key === "?") {
        e.preventDefault();
        useUiStore.getState().openPanel("shortcuts");
      } else if (key === "c") {
        // o próprio botão da tela (a ação certa para onde a pessoa está)
        const button = visible('[data-shortcut="c"]');
        if (button) {
          e.preventDefault();
          button.click();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  return (
    <Dialog open={help} onOpenChange={setHelp}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
          <DialogDescription>Funcionam fora dos campos de texto.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
          {OTHERS.map((o) => (
            <div key={o.label} className="contents">
              <dt>
                <Keys keys={o.keys} />
              </dt>
              <dd>{o.label}</dd>
            </div>
          ))}
          {GO.map((g) => (
            <div key={g.key} className="contents">
              <dt>
                <Keys keys={[["G", g.key.toUpperCase()]]} />
              </dt>
              <dd>{g.label}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
