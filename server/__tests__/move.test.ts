import { describe, expect, it } from "vitest";
import { createProjectAction } from "@/server/actions/project.actions";
import { createTaskAction, moveTaskAction } from "@/server/actions/task.actions";
import { ChangeHistory, Task } from "@/server/db/models";
import { actAs, createUser, createWorkspace, expectFail, expectOk, statusId } from "../../test/helpers";

async function setup() {
  const owner = await createUser("Dono");
  const ws = await createWorkspace(owner.id);
  actAs(owner.id);
  const project = expectOk(await createProjectAction({ workspaceId: ws.id, name: "Quadro", key: "QD" }));
  const todo = await statusId(project.id, "A Fazer");
  const done = await statusId(project.id, "Concluído");
  const tasks = [];
  for (const title of ["Primeira", "Segunda", "Terceira"]) {
    tasks.push(expectOk(await createTaskAction({ projectId: project.id, title })));
  }
  return { project, todo, done, ids: tasks.map((t) => t.id) };
}

/** Títulos da coluna na ordem em que o quadro mostra. */
async function column(projectId: string, status: string) {
  const tasks = await Task.find({ projectId, statusId: status }).sort({ rank: 1, createdAt: 1 }).lean();
  return tasks.map((t) => t.title);
}

describe("ordem no quadro", () => {
  it("tarefas novas entram no fim da coluna", async () => {
    const { project, todo } = await setup();
    expect(await column(project.id, todo)).toEqual(["Primeira", "Segunda", "Terceira"]);
  });

  it("move dentro da coluna e para outra coluna, registrando a troca de status", async () => {
    const { project, todo, done, ids } = await setup();
    expectOk(await moveTaskAction({ taskId: ids[2]!, statusId: todo, afterTaskId: null }));
    expect(await column(project.id, todo)).toEqual(["Terceira", "Primeira", "Segunda"]);

    expectOk(await moveTaskAction({ taskId: ids[0]!, statusId: todo, afterTaskId: ids[1]! }));
    expect(await column(project.id, todo)).toEqual(["Terceira", "Segunda", "Primeira"]);

    expectOk(await moveTaskAction({ taskId: ids[1]!, statusId: done, afterTaskId: null }));
    expect(await column(project.id, done)).toEqual(["Segunda"]);
    const entry = await ChangeHistory.findOne({ targetId: ids[1], "details.field": "status" }).lean();
    expect(entry?.details).toMatchObject({ oldValue: "A Fazer", newValue: "Concluído" });
  });

  it("manda para o fim da coluna (alternativa de teclado ao arrastar)", async () => {
    const { project, todo, ids } = await setup();
    expectOk(await moveTaskAction({ taskId: ids[0]!, statusId: todo, toEnd: true }));
    expect(await column(project.id, todo)).toEqual(["Segunda", "Terceira", "Primeira"]);
  });

  it("reordena a coluna quando os vizinhos empatam", async () => {
    const { project, todo, ids } = await setup();
    await Task.updateMany({ projectId: project.id }, { $set: { rank: "a0" } });
    expectOk(await moveTaskAction({ taskId: ids[0]!, statusId: todo, afterTaskId: ids[1]! }));
    const order = await column(project.id, todo);
    expect(order.indexOf("Primeira")).toBe(order.indexOf("Segunda") + 1);
  });

  it("recusa status de outro projeto", async () => {
    const { ids } = await setup();
    const other = await createUser("Outro");
    const ws = await createWorkspace(other.id);
    actAs(other.id);
    const p2 = expectOk(await createProjectAction({ workspaceId: ws.id, name: "Outro", key: "OT" }));
    const foreign = await statusId(p2.id, "A Fazer");
    expectFail(await moveTaskAction({ taskId: ids[0]!, statusId: foreign }), "não tem acesso");
  });
});
