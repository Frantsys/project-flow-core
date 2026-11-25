import type { WorkspaceRole } from "@/server/db/models";

/**
 * Quem pode o quê num workspace. Fonte única: as actions checam com `requirePermission` e as
 * telas escondem botões com `can`, então servidor e interface não divergem.
 */
const EVERYONE: readonly WorkspaceRole[] = ["OWNER", "ADMIN", "MEMBER"];
const MANAGERS: readonly WorkspaceRole[] = ["OWNER", "ADMIN"];

export const PERMISSIONS = {
  "workspace.view": EVERYONE,
  "workspace.update": MANAGERS,
  "workspace.delete": ["OWNER"],
  "member.manage": MANAGERS,
  "project.manage": MANAGERS,
  "sprint.manage": MANAGERS,
  "task.edit": EVERYONE,
  /** Membros excluem só as tarefas e os comentários que criaram. */
  "task.deleteAny": MANAGERS,
  "comment.deleteAny": MANAGERS,
  "document.edit": EVERYONE,
} as const satisfies Record<string, readonly WorkspaceRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: WorkspaceRole, permission: Permission) {
  return (PERMISSIONS[permission] as readonly WorkspaceRole[]).includes(role);
}

/** O papel do dono não muda; ninguém muda o próprio; admin só mexe em membros. */
export function canChangeRole(actor: WorkspaceRole, target: WorkspaceRole, isSelf: boolean) {
  if (target === "OWNER" || isSelf) return false;
  return actor === "OWNER" || (actor === "ADMIN" && target === "MEMBER");
}

/** Qualquer um pode sair (menos o dono); para remover outra pessoa valem as regras de papel. */
export function canRemoveMember(actor: WorkspaceRole, target: WorkspaceRole, isSelf: boolean) {
  if (target === "OWNER") return false;
  return isSelf || canChangeRole(actor, target, false);
}
