"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Ellipsis } from "lucide-react";
import { updateTaskStatusAction } from "@/server/actions/task.actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { StatusDTO } from "@/server/db/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** "Mover para…" no card: muda a coluna da tarefa pelo teclado ou pelo mouse. */
export function TaskStatusMenu({
  taskId,
  taskCode,
  statusId,
  statuses,
}: {
  taskId: string;
  taskCode: string;
  statusId: string;
  statuses: StatusDTO[];
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
