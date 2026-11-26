"use client";

import { RouteError } from "@/components/route-error";

/** Erro ao carregar esta página: a barra lateral e o que está em volta continuam na tela. */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <RouteError
      error={error}
      retry={retry}
      what="esta página"
      back={{ href: "/workspaces", label: "Ver os workspaces" }}
    />
  );
}
