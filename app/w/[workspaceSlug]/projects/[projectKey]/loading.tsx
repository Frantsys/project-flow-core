import { Skeleton } from "@/components/ui/skeleton";

/**
 * Troca de visão do projeto enquanto o conteúdo carrega: só a área embaixo do cabeçalho (o
 * cabeçalho e as abas ficam no layout e não somem).
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5 px-6 pt-5 pb-6 md:px-8" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-9 w-full max-w-3xl" />
      <div className="flex gap-3.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-80 w-[260px] shrink-0 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
