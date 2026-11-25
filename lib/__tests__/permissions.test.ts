import { describe, expect, it } from "vitest";
import { can, canChangeRole, canRemoveMember, PERMISSIONS, type Permission } from "@/lib/permissions";
import type { WorkspaceRole } from "@/server/db/models";

// Tabela esperada: muda só junto com uma decisão de produto
const expected: Record<Permission, WorkspaceRole[]> = {
  "workspace.view": ["OWNER", "ADMIN", "MEMBER"],
  "workspace.update": ["OWNER", "ADMIN"],
  "workspace.delete": ["OWNER"],
  "member.manage": ["OWNER", "ADMIN"],
  "project.manage": ["OWNER", "ADMIN"],
  "sprint.manage": ["OWNER", "ADMIN"],
  "task.edit": ["OWNER", "ADMIN", "MEMBER"],
  "task.deleteAny": ["OWNER", "ADMIN"],
  "comment.deleteAny": ["OWNER", "ADMIN"],
  "document.edit": ["OWNER", "ADMIN", "MEMBER"],
};

const roles: WorkspaceRole[] = ["OWNER", "ADMIN", "MEMBER"];

describe("matriz de permissões", () => {
  it("cobre exatamente as permissões esperadas", () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(Object.keys(expected).sort());
  });

  for (const [permission, allowed] of Object.entries(expected) as [Permission, WorkspaceRole[]][]) {
    for (const role of roles) {
      it(`${role} ${allowed.includes(role) ? "pode" : "não pode"} ${permission}`, () => {
        expect(can(role, permission)).toBe(allowed.includes(role));
      });
    }
  }
});

describe("papéis entre membros", () => {
  it.each([
    // ator, alvo, é a própria pessoa, pode mudar papel, pode remover
    ["OWNER", "ADMIN", false, true, true],
    ["OWNER", "MEMBER", false, true, true],
    ["OWNER", "OWNER", true, false, false],
    ["ADMIN", "MEMBER", false, true, true],
    ["ADMIN", "ADMIN", false, false, false],
    ["ADMIN", "ADMIN", true, false, true],
    ["ADMIN", "OWNER", false, false, false],
    ["MEMBER", "MEMBER", false, false, false],
    ["MEMBER", "MEMBER", true, false, true],
  ] as const)("%s → %s (self=%s): papel %s, remover %s", (actor, target, self, role, remove) => {
    expect(canChangeRole(actor, target, self)).toBe(role);
    expect(canRemoveMember(actor, target, self)).toBe(remove);
  });
});
