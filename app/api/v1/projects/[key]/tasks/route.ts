import { NextResponse } from "next/server";
import { apiError, authenticateApi } from "@/server/lib/api-auth";
import { listTasks } from "@/server/services/public-api.service";

/** GET /api/v1/projects/{key}/tasks?status=&limit=&offset= : tarefas do projeto, paginadas. */
export async function GET(request: Request, { params }: RouteContext<"/api/v1/projects/[key]/tasks">) {
  const auth = await authenticateApi(request);
  if ("error" in auth) return auth.error;
  const { key } = await params;
  const query = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(query.get("limit")) || 50, 1), 100);
  const offset = Math.max(Number(query.get("offset")) || 0, 0);
  const result = await listTasks(auth.workspaceId, key, { status: query.get("status"), limit, offset });
  if (!result) return apiError(404, `Projeto ${key} não encontrado neste workspace.`);
  return NextResponse.json({ data: result.tasks, pagination: { total: result.total, limit, offset } });
}
