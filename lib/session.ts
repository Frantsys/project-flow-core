import "server-only";
import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { getWorkspaceBySlug } from "@/server/services/workspace.service";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

/**
 * Lê a sessão da requisição atual e redireciona para o login se ela não existir.
 * Lê cookies: deve ser chamada dentro de um <Suspense> (Cache Components).
 */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    image: session.user.image ?? null,
  };
});

// Deduplica a busca do workspace entre o layout (sidebar) e a página na mesma requisição
export const getWorkspace = cache(getWorkspaceBySlug);
