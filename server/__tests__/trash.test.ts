import { describe, expect, it } from "vitest";
import { createProjectAction, deleteProjectAction } from "@/server/actions/project.actions";
import {
  addCommentAction,
  createTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/server/actions/task.actions";
import { createDocumentAction, deleteDocumentAction } from "@/server/actions/document.actions";
import { restoreTrashItemAction } from "@/server/actions/trash.actions";
import { Comment, DocumentModel, Sprint, Task, TrashItem } from "@/server/db/models";
import { getTrash } from "@/server/services/trash.service";
import { actAs, createUser, createWorkspace, expectFail, expectOk } from "../../test/helpers";

async function setup() {
  const owner = await createUser("Dono");
  const member = await createUser("Membro");
  const other = await createUser("Outra");
  const ws = await createWorkspace(owner.id, [
    { userId: member.id, role: "MEMBER" },
    { userId: other.id, role: "MEMBER" },
  ]);
  actAs(owner.id);
  const project = expectOk(await createProjectAction({ workspaceId: ws.id, name: "Lixo", key: "LX" }));
  return { owner, member, other, ws, project };
}

describe("lixeira", () => {
  it("excluir guarda a tarefa com os comentários, e restaurar devolve tudo como era", async () => {
    const { member, ws, project } = await setup();
    actAs(member.id);
    const { id } = expectOk(await createTaskAction({ projectId: project.id, title: "Voltar inteira" }));
    expectOk(await updateTaskAction({ taskId: id, tags: ["Front", "front", "API"] }));
    expectOk(await addCommentAction({ taskId: id, content: "um comentário" }));
    const before = (await Task.findById(id).lean())!;
    expect(before.tags).toEqual(["front", "API"]);

    const { trashId } = expectOk(await deleteTaskAction({ taskId: id }));
    expect(await Task.exists({ _id: id })).toBeNull();
    expect(await Comment.countDocuments({ taskId: id })).toBe(0);
    const list = (await getTrash(ws.id, member.id))!;
    expect(list).toMatchObject([
      { id: trashId, kind: "TASK", title: "LX-1 Voltar inteira", canRestore: true },
    ]);

    expectOk(await restoreTrashItemAction({ trashId }));
    const after = (await Task.findById(id).lean())!;
    expect(after).toMatchObject({ code: "LX-1", title: "Voltar inteira", tags: ["front", "API"] });
    expect(after.createdAt).toEqual(before.createdAt);
    expect(await Comment.countDocuments({ taskId: id })).toBe(1);
    expect(await TrashItem.countDocuments()).toBe(0);
    expectFail(await restoreTrashItemAction({ trashId }), "não está mais na lixeira");
  });

  it("tarefa: só quem excluiu ou um admin restaura; sprint excluída no meio tempo fica vazia", async () => {
    const { owner, member, other, project } = await setup();
    actAs(owner.id);
    const sprint = await Sprint.create({ projectId: project.id, name: "S1" });
    actAs(member.id);
    const { id } = expectOk(await createTaskAction({ projectId: project.id, title: "Da sprint" }));
    await Task.updateOne({ _id: id }, { sprintId: sprint._id });
    const { trashId } = expectOk(await deleteTaskAction({ taskId: id }));
    await Sprint.deleteOne({ _id: sprint._id });

    actAs(other.id);
    expectFail(await restoreTrashItemAction({ trashId }), "Só quem excluiu");
    actAs(owner.id);
    expectOk(await restoreTrashItemAction({ trashId }));
    expect((await Task.findById(id).lean())!.sprintId).toBeNull();
  });

  it("documento volta com os subdocumentos e vai para a raiz se o pai sumiu", async () => {
    const { member, ws } = await setup();
    actAs(member.id);
    const pai = expectOk(await createDocumentAction({ workspaceId: ws.id, title: "Pai" }));
    const filho = expectOk(
      await createDocumentAction({ workspaceId: ws.id, title: "Filho", parentId: pai.id })
    );
    const neto = expectOk(
      await createDocumentAction({ workspaceId: ws.id, title: "Neto", parentId: filho.id })
    );

    const { trashId, deleted } = expectOk(await deleteDocumentAction({ documentId: filho.id }));
    expect(deleted).toBe(2);
    await DocumentModel.deleteOne({ _id: pai.id });

    expectOk(await restoreTrashItemAction({ trashId }));
    const docs = await DocumentModel.find({ _id: { $in: [filho.id, neto.id] } }).lean();
    expect(docs.find((d) => d.title === "Filho")!.parentDocId).toBeNull();
    expect(docs.find((d) => d.title === "Neto")!.parentDocId!.toString()).toBe(filho.id);
  });

  it("excluir o projeto leva junto as tarefas dele que estavam na lixeira", async () => {
    const { owner, project } = await setup();
    const { id } = expectOk(await createTaskAction({ projectId: project.id, title: "Some" }));
    const { trashId } = expectOk(await deleteTaskAction({ taskId: id }));
    actAs(owner.id);
    expectOk(await deleteProjectAction({ projectId: project.id }));
    expect(await TrashItem.exists({ _id: trashId })).toBeNull();
  });
});
