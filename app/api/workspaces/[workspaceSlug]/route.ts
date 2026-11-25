import { authOptions } from "@/lib/auth";
import { getWorkspaceBySlug } from "@/server/services/workspace.service";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ workspaceSlug: string }> }) {
  const slug = (await params).workspaceSlug;
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const workspaceDetails = await getWorkspaceBySlug(slug, session.user.id);

    return NextResponse.json({ data: workspaceDetails }, { status: 200 });
  } catch (error) {
    console.error(`[GET /api/workspaces/${slug}]:`, error);
    return NextResponse.json(
      { error: `Erro interno ao entrar no workspace de slug: ${slug}.` },
      { status: 500 }
    );
  }
}
