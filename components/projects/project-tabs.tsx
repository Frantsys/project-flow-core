"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChartColumn, List, Rows3, SquareKanban } from "lucide-react";

const VIEWS = [
  { id: "board", label: "Quadro", icon: SquareKanban, path: "" },
  { id: "backlog", label: "Backlog", icon: List, path: "/backlog" },
  { id: "list", label: "Lista", icon: Rows3, path: "/list" },
  { id: "calendar", label: "Calendário", icon: CalendarDays, path: "/calendar" },
  { id: "reports", label: "Relatórios", icon: ChartColumn, path: "/reports" },
] as const;

/**
 * Visões do projeto. Ficam no layout, então não somem ao trocar de visão: a aba ativa desliza
 * (tab-active) e o conteúdo vai para o lado da aba escolhida (tab-forward / tab-back).
 */
export function ProjectTabs({ base }: { base: string }) {
  const pathname = usePathname();
  const rest = pathname.slice(base.length);
  // /tasks/PF-1 (tarefa em tela própria) não marca nenhuma visão
  const current = VIEWS.findIndex((v) => (v.path === "" ? rest === "" : rest.startsWith(v.path)));

  return (
    // navegação entre páginas, não abas: links com aria-current (abas sem painel confundem o leitor de tela)
    <nav aria-label="Visões do projeto">
      {/* três camadas na troca de visão: o trilho (parado, no cabeçalho), o fundo da aba ativa
          (tab-active, desliza) e os rótulos (tab-labels, parados por cima): o texto nunca viaja */}
      <div className="inline-flex h-8 w-fit max-w-full overflow-x-auto overflow-y-hidden rounded-lg bg-muted p-[3px] text-muted-foreground">
        <ul className="flex h-full items-center" style={{ viewTransitionName: "tab-labels" }}>
          {VIEWS.map((v, i) => {
            const active = i === current;
            return (
              <li key={v.id} className="h-full">
                <Link
                  href={`${base}${v.path}`}
                  aria-current={active ? "page" : undefined}
                  transitionTypes={[current >= 0 && i < current ? "tab-back" : "tab-forward"]}
                  aria-label={v.label}
                  className="relative isolate inline-flex h-full items-center gap-1.5 rounded-md px-1.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:text-foreground dark:text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0"
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 -z-10 rounded-md bg-background shadow-sm dark:border dark:border-input dark:bg-input/30"
                      style={{ viewTransitionName: "tab-active" }}
                    />
                  )}
                  <v.icon aria-hidden="true" />
                  <span className={active ? undefined : "hidden sm:inline"}>{v.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
