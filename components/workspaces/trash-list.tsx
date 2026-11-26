"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, ListTodo, RotateCcw } from "lucide-react";
import { restoreTrashItemAction } from "@/server/actions/trash.actions";
import type { TrashItemDTO } from "@/server/db/types";
import { timeAgo } from "@/lib/history-format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

export function TrashList({ items }: { items: TrashItemDTO[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function restore(item: TrashItemDTO) {
    startTransition(async () => {
      const result = await restoreTrashItemAction({ trashId: item.id });
      if (!result.success) return void toast.error(result.error);
      toast.success(`“${item.title}” foi restaurado.`);
      router.refresh();
    });
  }

  return (
    <Card className="gap-0 py-0">
      <ul className="divide-y">
        {items.map((item) => {
          const Icon = item.kind === "TASK" ? ListTodo : FileText;
          const left = daysLeft(item.expiresAt);
          return (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  <span className="sr-only">{item.kind === "TASK" ? "Tarefa" : "Documento"}: </span>
                  {item.title}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  Excluído por {item.deletedBy ?? "alguém"} {timeAgo(item.deletedAt)} ·{" "}
                  {left <= 1 ? "some amanhã" : `some em ${left} dias`}
                </p>
              </div>
              {item.canRestore && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  aria-label={`Restaurar ${item.title}`}
                  onClick={() => restore(item)}
                >
                  <RotateCcw aria-hidden="true" />
                  Restaurar
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
