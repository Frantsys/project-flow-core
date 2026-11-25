import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getTaskDetailsByCode } from "@/server/services/task.service";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      workspaceSlug: string;
      projectKey: string;
      taskCode: string;
    }>;
  }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const { workspaceSlug, projectKey, taskCode } = await params;

    const task = await getTaskDetailsByCode(
      workspaceSlug,
      projectKey,
      taskCode,
      session.user.id
    );

    if (!task) {
      return NextResponse.json(
        { error: "Tarefa não encontrada ou acesso negado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: task }, { status: 200 });
  } catch (error) {
    console.error(
      "[GET /api/workspaces/[workspaceSlug]/projects/[projectKey]/[taskCode]]:",
      error
    );
    return NextResponse.json(
      { error: "Erro interno ao carregar detalhes da tarefa." },
      { status: 500 }
    );
  }
}