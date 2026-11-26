"use client";

import { useParams } from "next/navigation";
import { RouteError } from "@/components/route-error";

/** Erro ao carregar os documentos: a barra lateral e o que está em volta continuam na tela. */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  return (
    <RouteError
      error={error}
      retry={retry}
      what="os documentos"
      back={{ href: `/w/${workspaceSlug}`, label: "Voltar à visão geral" }}
    />
  );
}
