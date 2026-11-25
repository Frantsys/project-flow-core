import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProjectsByWorkspaceSlug } from "@/server/services/project.service";

export async function GET(request: Request, { params }: { params: Promise<{ workspaceSlug: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { workspaceSlug } = await params;

    const projects = await getProjectsByWorkspaceSlug(workspaceSlug, session.user.id);

    if (projects === null) {
      return NextResponse.json({ error: "Workspace não encontrado ou acesso negado." }, { status: 404 });
    }

    return NextResponse.json({ data: projects }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/workspaces/[workspaceSlug]/projects]:", error);
    return NextResponse.json({ error: "Erro interno ao listar projetos." }, { status: 500 });
  }
}
