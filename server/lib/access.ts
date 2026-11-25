import "server-only";
import type { WorkspaceRole } from "../db/models";
import { verifyWorkspacePermission } from "../services/permission.service";
import { fail } from "./action";

export const ALL_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "MEMBER"];
export const MANAGERS: WorkspaceRole[] = ["OWNER", "ADMIN"];

/** Garante que o usuário tem um dos papéis no workspace e devolve o papel; senão interrompe a action. */
export async function requireWorkspaceRole(
  workspaceId: string,
  userId: string,
  allowedRoles: WorkspaceRole[]
): Promise<WorkspaceRole> {
  const permission = await verifyWorkspacePermission({ workspaceId, userId, allowedRoles });
  if (!permission.authorized) fail(permission.error);
  return permission.role;
}
