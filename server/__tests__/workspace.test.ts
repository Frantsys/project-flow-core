import { describe, expect, it } from "vitest";
import { createProjectAction, deleteProjectAction } from "@/server/actions/project.actions";
import { createTaskAction } from "@/server/actions/task.actions";
import { completeSprintAction, createSprintAction, startSprintAction } from "@/server/actions/sprint.actions";
import { addMemberAction, removeMemberAction, updateMemberRoleAction } from "@/server/actions/member.actions";
import { createDocumentAction, deleteDocumentAction } from "@/server/actions/document.actions";
import { deleteWorkspaceAction } from "@/server/actions/workspace.actions";
import { updateTaskAction } from "@/server/actions/task.actions";
import { getWorkspaceBySlug } from "@/server/services/workspace.service";
import { ChangeHistory, DocumentModel, Project, Sprint, Task, Workspace } from "@/server/db/models";
import { actAs, createUser, createWorkspace, expectFail, expectOk } from "../../test/helpers";

describe("getWorkspaceBySlug", () => {
  // regressão: os IDs vinham como ObjectId e o membro atual nunca era encontrado
  it("encontra o membro atual e devolve IDs como texto", async () => {
    const owner = await createUser();
    const ws = await createWorkspace(owner.id);
    const dto = await getWorkspaceBySlug(ws.slug, owner.id);
    expect(dto?.currentUserRole).toBe("OWNER");
    expect(typeof dto?.members[0]?.id).toBe("string");
  });
});

describe("sprints", () => {
  it("só uma sprint ativa por vez, e só dono/admin planejam", async () => {
    const owner = await createUser();
    const member = await createUser();
    const ws = await createWorkspace(owner.id, [{ userId: member.id, role: "MEMBER" }]);
    actAs(owner.id);
    const project = expectOk(await createProjectAction({ workspaceId: ws.id, name: "Projeto", key: "PP" }));
    const s1 = expectOk(await createSprintAction({ projectId: project.id, name: "Sprint 1" }));
    const s2 = expectOk(await createSprintAction({ projectId: project.id, name: "Sprint 2" }));

    actAs(member.id);
    expectFail(await startSprintAction({ sprintId: s1.id }), "permissão");

    actAs(owner.id);
    expectOk(await startSprintAction({ sprintId: s1.id }));
    expectFail(await startSprintAction({ sprintId: s2.id }), "Já existe uma sprint ativa");
  });

  it("ao concluir, move só as tarefas abertas para o destino escolhido", async () => {
    const owner = await createUser();
    const ws = await createWorkspace(owner.id);
    actAs(owner.id);
    const project = expectOk(await createProjectAction({ workspaceId: ws.id, name: "Projeto", key: "PP" }));
    const active = expectOk(await createSprintAction({ projectId: project.id, name: "Atual" }));
    const next = expectOk(await createSprintAction({ projectId: project.id, name: "Próxima" }));
    expectOk(await startSprintAction({ sprintId: active.id }));

    const open = expectOk(await createTaskAction({ projectId: project.id, title: "Aberta" }));
    const done = expectOk(
      await createTaskAction({ projectId: project.id, title: "Feita", status: "Concluído" })
    );
    for (const t of [open, done]) expectOk(await updateTaskAction({ taskId: t.id, sprintId: active.id }));

    const { moved } = expectOk(await completeSprintAction({ sprintId: active.id, moveToSprintId: next.id }));
    expect(moved).toBe(1);
    expect((await Task.findById(open.id).lean())?.sprintId?.toString()).toBe(next.id);
    expect((await Task.findById(done.id).lean())?.sprintId?.toString()).toBe(active.id);
    expect((await Sprint.findById(active.id).lean())?.status).toBe("COMPLETED");
  });
});

describe("membros", () => {
  async function team() {
    const owner = await createUser("Dono");
    const admin = await createUser("Admin");
    const admin2 = await createUser("Admin2");
    const member = await createUser("Membro");
    const ws = await createWorkspace(owner.id, [
      { userId: admin.id, role: "ADMIN" },
      { userId: admin2.id, role: "ADMIN" },
      { userId: member.id, role: "MEMBER" },
    ]);
    return { owner, admin, admin2, member, ws };
  }

  it("adiciona por e-mail existente e não duplica", async () => {
    const { owner, ws } = await team();
    const novo = await createUser("Novo");
    actAs(owner.id);
    expectFail(
      await addMemberAction({ workspaceId: ws.id, email: "ninguem@teste.dev", role: "MEMBER" }),
      "Não há conta"
    );
    expectOk(await addMemberAction({ workspaceId: ws.id, email: novo.email, role: "MEMBER" }));
    expectFail(
      await addMemberAction({ workspaceId: ws.id, email: novo.email, role: "MEMBER" }),
      "já é membro"
    );
  });

  it("protege o dono e impede admin de mexer em outro admin", async () => {
    const { owner, admin, admin2, member, ws } = await team();
    actAs(admin.id);
    expectFail(
      await updateMemberRoleAction({ workspaceId: ws.id, userId: owner.id, role: "MEMBER" }),
      "dono"
    );
    expectFail(await removeMemberAction({ workspaceId: ws.id, userId: admin2.id }), "Só o dono");
    expectOk(await updateMemberRoleAction({ workspaceId: ws.id, userId: member.id, role: "ADMIN" }));

    // o membro acabou de virar admin, e admin não remove outro admin
    actAs(member.id);
    expectFail(await removeMemberAction({ workspaceId: ws.id, userId: admin.id }), "Só o dono");

    actAs(owner.id);
    expectFail(await removeMemberAction({ workspaceId: ws.id, userId: owner.id }), "dono não pode");
    expectOk(await removeMemberAction({ workspaceId: ws.id, userId: admin2.id }));
  });

  it("qualquer membro pode sair do workspace", async () => {
    const { member, ws } = await team();
    actAs(member.id);
    expectOk(await removeMemberAction({ workspaceId: ws.id, userId: member.id }));
    const doc = await Workspace.findById(ws.id).lean();
    expect(doc?.members.some((m) => m.userId.toString() === member.id)).toBe(false);
  });
});

describe("exclusões em cascata", () => {
  it("excluir um documento leva junto toda a subárvore", async () => {
    const owner = await createUser();
    const ws = await createWorkspace(owner.id);
    actAs(owner.id);
    const root = expectOk(await createDocumentAction({ workspaceId: ws.id, title: "Raiz" }));
    const child = expectOk(await createDocumentAction({ workspaceId: ws.id, parentId: root.id }));
    expectOk(await createDocumentAction({ workspaceId: ws.id, parentId: child.id }));
    const other = expectOk(await createDocumentAction({ workspaceId: ws.id, title: "Outro" }));

    expect(expectOk(await deleteDocumentAction({ documentId: root.id })).deleted).toBe(3);
    expect((await DocumentModel.find().lean()).map((d) => d._id.toString())).toEqual([other.id]);
  });

  it("excluir um projeto apaga tarefas, sprints e documentos dele, e nada de outro projeto", async () => {
    const owner = await createUser();
    const ws = await createWorkspace(owner.id);
    actAs(owner.id);
    const a = expectOk(await createProjectAction({ workspaceId: ws.id, name: "Alfa", key: "AA" }));
    const b = expectOk(await createProjectAction({ workspaceId: ws.id, name: "Beta", key: "BB" }));
    for (const p of [a, b]) {
      expectOk(await createTaskAction({ projectId: p.id, title: "Tarefa" }));
      expectOk(await createSprintAction({ projectId: p.id, name: "Sprint" }));
      expectOk(await createDocumentAction({ workspaceId: ws.id, projectId: p.id }));
    }

    expectOk(await deleteProjectAction({ projectId: a.id }));
    expect(await Task.countDocuments({ projectId: a.id })).toBe(0);
    expect(await Sprint.countDocuments({ projectId: a.id })).toBe(0);
    expect(await DocumentModel.countDocuments({ projectId: a.id })).toBe(0);
    expect(await Task.countDocuments({ projectId: b.id })).toBe(1);
  });

  it("só o dono exclui o workspace, e tudo dele vai junto", async () => {
    const owner = await createUser();
    const admin = await createUser();
    const ws = await createWorkspace(owner.id, [{ userId: admin.id, role: "ADMIN" }]);
    actAs(owner.id);
    const p = expectOk(await createProjectAction({ workspaceId: ws.id, name: "Projeto", key: "PP" }));
    expectOk(await createTaskAction({ projectId: p.id, title: "Tarefa" }));
    expectOk(await createDocumentAction({ workspaceId: ws.id }));

    actAs(admin.id);
    expectFail(await deleteWorkspaceAction({ workspaceId: ws.id }), "permissão");

    actAs(owner.id);
    expectOk(await deleteWorkspaceAction({ workspaceId: ws.id }));
    for (const model of [Workspace, Project, Task, DocumentModel, ChangeHistory] as const) {
      expect(await (model as typeof Task).countDocuments()).toBe(0);
    }
  });
});
