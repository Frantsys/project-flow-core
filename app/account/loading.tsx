import { Skeleton } from "@/components/ui/skeleton";

/** Carregando a página: o mesmo formato de lista que ela vai ter. */
export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full max-w-[880px] flex-col gap-4 px-6 py-10"
      aria-busy="true"
      aria-label="Carregando"
    >
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
