import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-muted bg-[linear-gradient(90deg,transparent_25%,color-mix(in_oklab,var(--foreground)_5%,transparent)_50%,transparent_75%)] bg-size-[200%_100%] animate-[pf-shimmer_1.6s_ease-in-out_infinite] motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
