import { Skeleton } from "@/components/ui/skeleton";

/** Primeira entrada numa tela do workspace: título e blocos no lugar do conteúdo. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5 p-6 md:p-8" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}
