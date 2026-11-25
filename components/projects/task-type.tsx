import { typeLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { TaskType } from "@/server/db/types";

const COLORS: Record<TaskType, string> = {
  TASK: "bg-type-task rounded-[3px]",
  BUG: "bg-type-bug rounded-full", // forma diferente, não só a cor
  STORY: "bg-type-story rounded-[3px]",
  EPIC: "bg-type-epic rounded-[3px]",
};

export function TaskTypeIndicator({ type }: { type: TaskType }) {
  return (
    <span
      role="img"
      aria-label={`Tipo: ${typeLabel[type]}`}
      title={typeLabel[type]}
      className={cn("inline-block size-2.5 shrink-0", COLORS[type])}
    />
  );
}
