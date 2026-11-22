import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserWorkspaces } from "@/server/services/workspace.service";


export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autorizado." },
        { status: 401 }
      );
    }

    const workspaces = await getUserWorkspaces(session.user.id);

    return NextResponse.json({ data: workspaces }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/workspaces]:", error);
    return NextResponse.json(
      { error: "Erro interno ao listar workspaces." },
      { status: 500 }
    );
  }
}