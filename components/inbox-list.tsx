"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { markNotificationsReadAction } from "@/server/actions/notification.actions";
import type { NotificationDTO } from "@/server/services/notification.service";
import { describeNotification } from "@/lib/notification-format";
import { timeAgo } from "@/lib/history-format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";

export function InboxList({ items }: { items: NotificationDTO[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const unread = items.filter((n) => !n.read).length;

  function open(n: NotificationDTO) {
    // marca como lida sem esperar: a navegação não fica presa na action
    if (!n.read) void markNotificationsReadAction({ ids: [n.id] });
    router.push(n.href);
  }

  function markAll() {
    startTransition(async () => {
      const result = await markNotificationsReadAction({});
      if (!result.success) return void toast.error(result.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {unread === 0 ? "Tudo lido." : unread === 1 ? "1 não lida" : `${unread} não lidas`}
        </p>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAll} disabled={pending}>
            <CheckCheck aria-hidden="true" />
            Marcar todas como lidas
          </Button>
        )}
      </div>
      <Card className="gap-0 py-0">
        <ul className="divide-y">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left text-sm outline-none hover:bg-muted/60 focus-visible:bg-muted",
                  !n.read && "bg-info-bg/40"
                )}
              >
                <UserAvatar name={n.actor?.name ?? "?"} image={n.actor?.image} />
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
      </Card>
    </div>
  );
}
