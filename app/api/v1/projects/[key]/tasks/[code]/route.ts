import { NextResponse } from "next/server";
import { apiError, authenticateApi } from "@/server/lib/api-auth";
import { getTask } from "@/server/services/public-api.service";

/** GET /api/v1/projects/{key}/tasks/{code}: uma tarefa com descrição e subtarefas. */
export async function GET(request: Request, { params }: RouteContext<"/api/v1/projects/[key]/tasks/[code]">) {
  const auth = await authenticateApi(request);
  if ("error" in auth) return auth.error;
  const { key, code } = await params;
  const task = await getTask(auth.workspaceId, key, code);
  if (!task) return apiError(404, `Tarefa ${code} não encontrada.`);
  return NextResponse.json({ data: task });
}
