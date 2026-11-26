"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * Conteúdo dos error.tsx: diz o que falhou, oferece tentar de novo (retry busca os dados de novo)
 * e um caminho para sair. O layout em volta (barra lateral, cabeçalho do projeto) continua.
 */
export function RouteError({
  error,
  retry,
  what,
  back,
}: {
  error: unknown;
  retry: () => void;
  /** "este projeto", "esta página"… */
  what: string;
  back: { href: string; label: string };
}) {
  useEffect(() => console.error(error), [error]);
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <div className="flex flex-1 items-center justify-center p-6 md:p-8">
      <Empty className="max-w-md border bg-background">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Não foi possível carregar {what}</EmptyTitle>
          <EmptyDescription>
            Pode ser uma falha passageira na conexão. Tente de novo; se continuar, volte daqui a pouco.
            {digest && <span className="mt-2 block font-mono text-xs">Código: {digest}</span>}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button onClick={() => retry()}>Tentar de novo</Button>
          <Button asChild variant="outline">
            <Link href={back.href}>{back.label}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
