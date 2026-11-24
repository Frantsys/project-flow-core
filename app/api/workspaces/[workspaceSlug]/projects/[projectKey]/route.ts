import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProjectByKey } from "@/server/services/project.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceSlug: string; projectKey: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const { workspaceSlug, projectKey } = await params;

    const project = await getProjectByKey(
      workspaceSlug,
      projectKey,
      session.user.id
    );

    if (!project) {
      return NextResponse.json(
        { error: "Projeto não encontrado ou acesso negado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: project }, { status: 200 });
  } catch (error) {
    console.error(
      "[GET /api/workspaces/[workspaceSlug]/projects/[projectKey]]:",
      error
    );
    return NextResponse.json(
      { error: "Erro interno ao carregar detalhes do projeto." },
      { status: 500 }
    );
  }
}