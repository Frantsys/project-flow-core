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

/** Erro inesperado em qualquer página: mantém o layout e oferece tentar de novo. */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => console.error(error), [error]);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Empty className="max-w-md border bg-background">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Algo deu errado</EmptyTitle>
          <EmptyDescription>
            Não conseguimos carregar esta página. Tente de novo em instantes.
            {error.digest && <span className="mt-2 block font-mono text-xs">Código: {error.digest}</span>}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button onClick={() => retry()}>Tentar de novo</Button>
          <Button asChild variant="outline">
            <Link href="/workspaces">Ir para os workspaces</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
