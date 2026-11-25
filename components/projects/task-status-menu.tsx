"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpToLine, Check, Ellipsis } from "lucide-react";
import { moveTaskAction, updateTaskStatusAction } from "@/server/actions/task.actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { StatusDTO } from "@/server/db/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** "Mover para…" no card: muda a coluna da tarefa pelo teclado ou pelo mouse. */
export function TaskStatusMenu({
  taskId,
  taskCode,
  statusId,
  statuses,
  canReorder = false,
}: {
  taskId: string;
  taskCode: string;
  statusId: string;
  statuses: StatusDTO[];
  /** Mostra "Topo/Fim da coluna": a alternativa de teclado ao arrastar no quadro. */
  canReorder?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function move(next: StatusDTO) {
    if (next.id === statusId) return;
    startTransition(async () => {
      const result = await updateTaskStatusAction({ taskId, statusId: next.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`${taskCode} movida para ${next.name}.`);
      router.refresh();
    });
  }

  function reorder(toEnd: boolean) {
    startTransition(async () => {
      const result = await moveTaskAction({ taskId, statusId, afterTaskId: null, toEnd });
      if (!result.success) return void toast.error(result.error);
      toast.success(`${taskCode} foi para o ${toEnd ? "fim" : "topo"} da coluna.`);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Mover ${taskCode}`} disabled={pending}>
          {pending ? <Spinner /> : <Ellipsis aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Mover para</DropdownMenuLabel>
        {statuses.map((s) => (
          <DropdownMenuItem key={s.id} disabled={s.id === statusId} onSelect={() => move(s)}>
            <span className="flex-1">{s.name}</span>
            {s.id === statusId && <Check aria-label="Status atual" />}
          </DropdownMenuItem>
        ))}
        {canReorder && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => reorder(false)}>
              <ArrowUpToLine aria-hidden="true" />
              Topo da coluna
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => reorder(true)}>
              <ArrowDownToLine aria-hidden="true" />
              Fim da coluna
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
