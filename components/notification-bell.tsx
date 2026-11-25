"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { getUnreadCountAction } from "@/server/actions/notification.actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const POLL = 60_000;

/** Sino com o número de notificações não lidas; atualiza ao abrir, ao voltar à aba e a cada minuto. */
export function NotificationBell({ className }: { className?: string }) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

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
  }, [pathname]); // ao navegar (ex.: sair da caixa de entrada) o número é conferido de novo

  const label = count > 0 ? `Notificações, ${count} não lidas` : "Notificações";
  return (
    <Button asChild variant="outline" size="icon" className={cn("relative shrink-0", className)}>
      <Link href="/inbox" aria-label={label} title={label}>
        <Bell aria-hidden="true" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground tabular-nums"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    </Button>
  );
}
