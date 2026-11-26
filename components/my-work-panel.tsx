"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ListChecks, PartyPopper, X } from "lucide-react";
import { getMyWorkAction } from "@/server/actions/my-work.actions";
import { groupByDue, type MyTaskDTO } from "@/lib/my-work";
import { shortDate } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarMenuBadge, SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { TaskTypeIndicator } from "@/components/projects/task-type";

export const MY_WORK_EVENT = "pf:toggle-my-work";

/**
 * Minhas tarefas num painel por cima da página, aberto pela barra lateral (ou G M): a pessoa vê o
 * que está com ela sem sair do quadro. Começa no workspace atual; a página /my-work continua para a
 * lista completa.
 */
export function MyWorkPanel({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"here" | "all">("here");
  const [data, setData] = useState<{ tasks: MyTaskDTO[]; today: string } | null>(null);

  const load = useCallback(async () => {
    const result = await getMyWorkAction({});
    if (result.success) setData(result.data);
  }, []);

  // o contador da barra se atualiza ao navegar (uma tarefa concluída sai da lista)
  useEffect(() => {
    let alive = true;
    getMyWorkAction({}).then((result) => {
      if (alive && result.success) setData(result.data);
    });
    return () => {
      alive = false;
    };
  }, [pathname]);

  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    window.addEventListener(MY_WORK_EVENT, toggle);
    return () => window.removeEventListener(MY_WORK_EVENT, toggle);
  }, []);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) void load();
  }

  const here = data?.tasks.filter((t) => t.workspace.slug === workspaceSlug) ?? [];
  const shown = scope === "here" ? here : (data?.tasks ?? []);
  const groups = data ? groupByDue(shown, data.today) : [];

  const close = () => {
    setOpen(false);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <SidebarMenuButton isActive={open} title="Minhas tarefas (G M)">
          <ListChecks aria-hidden="true" />
          Minhas tarefas
        </SidebarMenuButton>
      </PopoverTrigger>
      {here.length > 0 && (
        <SidebarMenuBadge aria-label={`${here.length} abertas neste workspace`}>
          {here.length}
        </SidebarMenuBadge>
      )}
      <PopoverContent
        side={isMobile ? "bottom" : "right"}
        align="start"
        sideOffset={8}
        aria-label="Minhas tarefas"
        className="flex max-h-[min(640px,calc(100svh-2rem))] w-[420px] max-w-[calc(100vw-1.5rem)] flex-col gap-0 p-0"
      >
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <h2 className="text-[15px] font-semibold">Minhas tarefas</h2>
          {data && (
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {shown.length === 1 ? "1 aberta" : `${shown.length} abertas`}
            </span>
          )}
          <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Fechar" onClick={close}>
            <X aria-hidden="true" />
          </Button>
        </div>
        {/* dois botões de alternar, não abas: o conteúdo é a mesma lista com outro filtro */}
        <div
          role="group"
          aria-label="Mostrar tarefas de"
          className="mx-3 mb-2 inline-flex w-fit rounded-lg bg-muted p-[3px]"
        >
          {(
            [
              ["here", "Neste workspace"],
              ["all", "Todos os workspaces"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => setScope(value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm text-text-secondary outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                scope === value && "bg-background font-medium text-foreground shadow-xs"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto border-y py-1">
          {!data ? (
            <div className="flex justify-center py-8">
              <Spinner className="text-muted-foreground" />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-8 text-center text-sm text-muted-foreground">
              <PartyPopper className="size-5" aria-hidden="true" />
              Nada pendente com você {scope === "here" ? "neste workspace" : ""}.
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.id} aria-labelledby={`mw-${g.id}`}>
                <h3
                  id={`mw-${g.id}`}
                  className={cn(
                    "px-3 pt-2 pb-0.5 text-xs font-semibold text-text-secondary",
                    g.id === "overdue" && "text-destructive-text"
                  )}
                >
                  {g.label} <span className="font-medium text-muted-foreground">{g.tasks.length}</span>
                </h3>
                <ul>
                  {g.tasks.map((t) => {
                    const late = g.id === "overdue" || g.id === "today";
                    return (
                      <li key={t.id}>
                        <Link
                          href={t.href}
                          scroll={false}
                          onClick={close}
                          className="flex items-center gap-2 px-3 py-1.5 text-[13px] outline-none hover:bg-muted focus-visible:bg-muted"
                        >
                          <TaskTypeIndicator type={t.type} />
                          <span className="w-14 shrink-0 font-mono text-xs text-text-secondary">
                            {t.code}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                          {scope === "all" && t.workspace.slug !== workspaceSlug && (
                            <span className="max-w-24 truncate text-xs text-muted-foreground">
                              {t.workspace.name}
                            </span>
                          )}
                          <span className="rounded-sm border px-1 text-[11px] text-text-secondary">
                            {t.project.key}
                          </span>
                          {t.dueDate && (
                            <span
                              className={cn(
                                "w-12 shrink-0 text-right text-xs",
                                late ? "font-medium text-destructive-text" : "text-text-secondary"
                              )}
                            >
                              {t.dueDate === data.today ? "hoje" : shortDate(`${t.dueDate}T00:00:00Z`)}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
        <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground">
          <span className="hidden sm:inline">
            <kbd className="rounded border bg-muted px-1 font-mono text-[11px] text-foreground">G</kbd>{" "}
            <kbd className="rounded border bg-muted px-1 font-mono text-[11px] text-foreground">M</kbd> abre o
            painel
          </span>
          <Link
            href="/my-work"
            onClick={close}
            className="ml-auto inline-flex items-center gap-1 font-medium text-foreground hover:underline"
          >
            Abrir em página inteira
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
