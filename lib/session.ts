import "server-only";
import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { getWorkspaceBySlug } from "@/server/services/workspace.service";
import { getWorkspaceDocuments } from "@/server/services/document.service";
import { getProjectByKey } from "@/server/services/project.service";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  /** Sessão da demonstração pública (só leitura). */
  isDemo: boolean;
}

/**
 * Lê a sessão da requisição atual e redireciona para o login se ela não existir.
 * Lê cookies: deve ser chamada dentro de um <Suspense> (Cache Components).
 */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const session = await getServerSession(authOptions);
  // o proxy já manda quem não tem cookie para o login; aqui chega quem tem cookie de uma sessão encerrada
  if (!session?.user?.id) redirect("/auth/login?error=SessionRevoked");

  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    image: session.user.image ?? null,
    isDemo: !!session.user.demo,
  };
});

// Deduplica a busca do workspace entre o layout (sidebar) e a página na mesma requisição
export const getWorkspace = cache(getWorkspaceBySlug);

// Árvore de documentos: usada pelo layout (navegação) e pela página (trilha) na mesma requisição
export const getDocuments = cache(getWorkspaceDocuments);

// Projeto lido pelo layout (cabeçalho) e pela página (conteúdo) na mesma requisição
export const getProject = cache(getProjectByKey);
