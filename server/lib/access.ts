import "server-only";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import type { WorkspaceRole } from "../db/models";
import { verifyWorkspacePermission } from "../services/permission.service";
import { fail } from "./action";

/** Garante que o papel do usuário no workspace tem a permissão e devolve o papel; senão interrompe a action. */
export async function requirePermission(
  workspaceId: string,
  userId: string,
  permission: Permission
): Promise<WorkspaceRole> {
  const result = await verifyWorkspacePermission({
    workspaceId,
    userId,
    allowedRoles: [...PERMISSIONS[permission]],
  });
  if (!result.authorized) fail(result.error);
  return result.role;
}
