import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { createProjectAction, updateProjectStatusesAction } from "@/server/actions/project.actions";
import { createTaskAction } from "@/server/actions/task.actions";
import { Project, Task } from "@/server/db/models";
import { actAs, createUser, createWorkspace, expectFail, expectOk, statusId } from "../../test/helpers";

async function setup() {
  const owner = await createUser("Dono");
  const member = await createUser("Membro");
  const ws = await createWorkspace(owner.id, [{ userId: member.id, role: "MEMBER" }]);
  actAs(owner.id);
  const project = expectOk(await createProjectAction({ workspaceId: ws.id, name: "Quadro", key: "QD" }));
  const ids = {
    todo: await statusId(project.id, "A Fazer"),
    doing: await statusId(project.id, "Em Andamento"),
    review: await statusId(project.id, "Revisão"),
    done: await statusId(project.id, "Concluído"),
  };
  return { owner, member, project, ids };
}

describe("colunas do quadro", () => {
  it("renomear e reordenar mantém as tarefas no mesmo status", async () => {
    const { project, ids } = await setup();
    const task = expectOk(
      await createTaskAction({ projectId: project.id, title: "Tarefa", statusId: ids.review })
    );

    expectOk(
      await updateProjectStatusesAction({
        projectId: project.id,
        statuses: [
          { id: ids.todo, name: "Backlog", category: "TODO" },
          { id: ids.review, name: "Code review", category: "IN_PROGRESS" },
          { id: ids.doing, name: "Fazendo", category: "IN_PROGRESS" },
          { id: ids.done, name: "Pronto", category: "DONE" },
        ],
      })
    );
    const saved = await Project.findById(project.id).lean();
    expect(saved!.statuses.map((s) => s.name)).toEqual(["Backlog", "Code review", "Fazendo", "Pronto"]);
    expect((await Task.findById(task.id).lean())!.statusId.toString()).toBe(ids.review);
  });

  it("status removido leva as tarefas para o primeiro da mesma categoria", async () => {
    const { project, ids } = await setup();
    const task = expectOk(
      await createTaskAction({ projectId: project.id, title: "Tarefa", statusId: ids.review })
    );

    const { moved } = expectOk(
      await updateProjectStatusesAction({
        projectId: project.id,
        statuses: [
          { id: ids.todo, name: "A Fazer", category: "TODO" },
          { name: "Testando", category: "IN_PROGRESS" },
          { id: ids.done, name: "Concluído", category: "DONE" },
        ],
      })
    );
    expect(moved).toBe(1);
    const testing = await statusId(project.id, "Testando");
    expect((await Task.findById(task.id).lean())!.statusId.toString()).toBe(testing);
  });

  it("exige um status de concluído, nomes únicos e ids do próprio projeto", async () => {
    const { project, ids } = await setup();
    const base = { projectId: project.id };
    expectFail(
      await updateProjectStatusesAction({
        ...base,
        statuses: [
          { id: ids.todo, name: "A", category: "TODO" },
          { id: ids.doing, name: "B", category: "IN_PROGRESS" },
        ],
      }),
      "Dados inválidos"
    );
    expectFail(
      await updateProjectStatusesAction({
        ...base,
        statuses: [
          { id: ids.todo, name: "Igual", category: "TODO" },
          { id: ids.done, name: "igual", category: "DONE" },
        ],
      }),
      "Dados inválidos"
    );
    expectFail(
      await updateProjectStatusesAction({
        ...base,
        statuses: [
          { id: new Types.ObjectId().toString(), name: "A", category: "TODO" },
          { id: ids.done, name: "B", category: "DONE" },
        ],
      }),
      "não pertence"
    );
  });

  it("membro comum não edita as colunas", async () => {
    const { project, member, ids } = await setup();
    actAs(member.id);
    expectFail(
      await updateProjectStatusesAction({
        projectId: project.id,
        statuses: [
          { id: ids.todo, name: "A", category: "TODO" },
          { id: ids.done, name: "B", category: "DONE" },
        ],
      }),
      "permissão"
    );
  });
});

describe("colunas personalizadas", () => {
  it("guarda cor e limite, e quem não manda esses campos não os apaga", async () => {
    const { project, ids } = await setup();
    const base = [
      { id: ids.todo, name: "A Fazer", category: "TODO" as const },
      {
        id: ids.doing,
        name: "Em Andamento",
        category: "IN_PROGRESS" as const,
        color: "violet" as const,
        wipLimit: 3,
      },
      { id: ids.done, name: "Concluído", category: "DONE" as const },
    ];
    expectOk(await updateProjectStatusesAction({ projectId: project.id, statuses: base }));
    // o diálogo de colunas só manda nome e tipo
    const result = expectOk(
      await updateProjectStatusesAction({
        projectId: project.id,
        statuses: base.map(({ id, name, category }) => ({ id, name, category })),
      })
    );
    expect(result.statuses[1]).toMatchObject({ color: "violet", wipLimit: 3 });
    expectFail(
      await updateProjectStatusesAction({
        projectId: project.id,
        statuses: base.map((s) => ({ ...s, wipLimit: 0 })),
      }),
      "Dados inválidos"
    );
  });

  it("excluir coluna manda as tarefas para a coluna escolhida", async () => {
    const { project, ids } = await setup();
    const task = expectOk(
      await createTaskAction({ projectId: project.id, title: "Vai junto", statusId: ids.review })
    );
    expectOk(
      await updateProjectStatusesAction({
        projectId: project.id,
        statuses: [
          { id: ids.todo, name: "A Fazer", category: "TODO" },
          { id: ids.doing, name: "Em Andamento", category: "IN_PROGRESS" },
          { id: ids.done, name: "Concluído", category: "DONE" },
        ],
        moveTasksTo: { [ids.review]: ids.todo },
      })
    );
    expect((await Task.findById(task.id).lean())!.statusId.toString()).toBe(ids.todo);
  });
});
