import { SquareKanban } from "lucide-react";
import { cn } from "@/lib/utils";

/** Marca do Project Flow: ícone em bloco + nome. `inverted` para fundos escuros. */
export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5 font-semibold", className)}>
      <span
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-lg",
          inverted ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
        )}
      >
        <SquareKanban className="size-4" aria-hidden="true" />
      </span>
      Project Flow
    </span>
  );
}
