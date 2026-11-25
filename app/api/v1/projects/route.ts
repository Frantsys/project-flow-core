import { NextResponse } from "next/server";
import { authenticateApi } from "@/server/lib/api-auth";
import { listProjects } from "@/server/services/public-api.service";

/** GET /api/v1/projects: projetos do workspace do token. */
export async function GET(request: Request) {
  const auth = await authenticateApi(request);
  if ("error" in auth) return auth.error;
  return NextResponse.json({ data: await listProjects(auth.workspaceId) });
}
