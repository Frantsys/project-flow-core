"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Bell, CheckCheck } from "lucide-react";
import {
  getRecentNotificationsAction,
  getUnreadCountAction,
  markNotificationsReadAction,
} from "@/server/actions/notification.actions";
import type { NotificationDTO } from "@/server/services/notification.service";
import type { NotificationType } from "@/server/db/models";
import { describeNotification } from "@/lib/notification-format";
import { timeAgo } from "@/lib/history-format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { UserAvatar } from "@/components/user-avatar";

const POLL = 60_000;

const FILTERS: { id: string; label: string; types?: NotificationType[] }[] = [
  { id: "all", label: "Todas" },
  { id: "mentions", label: "Menções", types: ["MENTIONED"] },
  { id: "assigned", label: "Atribuídas", types: ["ASSIGNED"] },
];

/**
 * Sino com o número de não lidas. Abre um painel por cima da tela com as 20 mais recentes; a
 * caixa de entrada (/inbox) fica para o histórico todo. O número atualiza ao navegar, ao voltar à
 * aba e a cada minuto.
 */
export function NotificationBell({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDTO[] | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      const result = await getUnreadCountAction({});
      if (alive && result.success) setCount(result.data);
    };
    void load();
    const timer = setInterval(load, POLL);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [pathname]);

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    const result = await getRecentNotificationsAction({});
    if (result.success) setItems(result.data);
  }

  function openItem(n: NotificationDTO) {
    setOpen(false);
    if (!n.read) {
      setCount((c) => Math.max(0, c - 1));
      // sem esperar: a navegação não fica presa na action
      void markNotificationsReadAction({ ids: [n.id] });
    }
    router.push(n.href, { scroll: false });
  }

  async function markAll() {
    const result = await markNotificationsReadAction({});
    if (!result.success) return;
    setCount(0);
    setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? null);
  }

  const types = FILTERS.find((f) => f.id === filter)?.types;
  const shown = items?.filter((n) => !types || types.includes(n.type)) ?? [];
  const label = count > 0 ? `Notificações, ${count} não lidas` : "Notificações";

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={label}
          title={label}
          className={cn("relative shrink-0", className)}
        >
          <Bell aria-hidden="true" />
          {count > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground tabular-nums"
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        aria-label="Notificações"
        className="flex max-h-[min(600px,calc(100svh-2rem))] w-[400px] max-w-[calc(100vw-1.5rem)] flex-col gap-0 p-0"
      >
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <h2 className="text-[15px] font-semibold">Notificações</h2>
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {count === 0 ? "tudo lido" : count === 1 ? "1 não lida" : `${count} não lidas`}
          </span>
          {count > 0 && (
            <Button variant="ghost" size="sm" className="ml-auto" onClick={markAll}>
              <CheckCheck aria-hidden="true" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <div
          role="group"
          aria-label="Mostrar"
          className="mx-3 mb-2 inline-flex w-fit rounded-lg bg-muted p-[3px]"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm text-text-secondary outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                filter === f.id && "bg-background font-medium text-foreground shadow-xs"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto border-y">
          {!items ? (
            <div className="flex justify-center py-8">
              <Spinner className="text-muted-foreground" />
            </div>
          ) : shown.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              {filter === "all" ? "Nenhuma notificação por enquanto." : "Nada com esse filtro."}
            </p>
          ) : (
            <ul className="divide-y">
              {shown.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={cn(
                      "flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-[13px] outline-none hover:bg-muted/60 focus-visible:bg-muted",
                      !n.read && "bg-info-bg/40"
                    )}
                  >
                    <UserAvatar name={n.actor?.name ?? "?"} image={n.actor?.image} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block", !n.read && "font-medium")}>
                        {describeNotification(n.type, n.actor?.name ?? "Alguém", n.title)}
                      </span>
                      <span className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.read && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-info-fg">
                        <span className="sr-only">Não lida</span>
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex px-3 py-2 text-[13px]">
          <Link
            href="/inbox"
            onClick={() => setOpen(false)}
            className="ml-auto inline-flex items-center gap-1 font-medium hover:underline"
          >
            Ver todas
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
