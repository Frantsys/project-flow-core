import { describe, expect, it } from "vitest";
import { createProjectAction } from "@/server/actions/project.actions";
import {
  addCommentAction,
  addSubtaskAction,
  createTaskAction,
  deleteCommentAction,
  deleteTaskAction,
  toggleSubtaskAction,
  updateTaskAction,
} from "@/server/actions/task.actions";
import { ChangeHistory, Task } from "@/server/db/models";
import { actAs, createUser, createWorkspace, expectFail, expectOk, statusId } from "../../test/helpers";

async function setup() {
  const owner = await createUser("Dono");
  const member = await createUser("Membro");
  const outsider = await createUser("Fora");
  const ws = await createWorkspace(owner.id, [{ userId: member.id, role: "MEMBER" }]);
  actAs(owner.id);
  const project = expectOk(
    await createProjectAction({ workspaceId: ws.id, name: "Project Flow", key: "PF" })
  );
  return { owner, member, outsider, ws, project };
}

describe("createTaskAction", () => {
  it("exige login", async () => {
    const { project } = await setup();
    actAs(null);
    expectFail(await createTaskAction({ projectId: project.id, title: "Sem login" }), "Sessão expirada");
  });

  it("gera códigos sequenciais por projeto, inclusive em criações simultâneas", async () => {
    const { project, member } = await setup();
    actAs(member.id);
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => createTaskAction({ projectId: project.id, title: `Tarefa ${i}` }))
    );
    const codes = results
      .map((r) => expectOk(r).code)
      .sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]));
    expect(codes).toEqual(["PF-1", "PF-2", "PF-3", "PF-4", "PF-5", "PF-6", "PF-7", "PF-8"]);
  });

  it("usa o primeiro status A fazer do projeto e recusa status de outro projeto", async () => {
    const { project, ws } = await setup();
    const { id } = expectOk(await createTaskAction({ projectId: project.id, title: "Padrão" }));
    expect((await Task.findById(id).lean())?.statusId.toString()).toBe(await statusId(project.id, "A Fazer"));
    const other = expectOk(await createProjectAction({ workspaceId: ws.id, name: "Outro", key: "OUT" }));
    expectFail(
      await createTaskAction({
        projectId: project.id,
        title: "Ruim",
        statusId: await statusId(other.id, "A Fazer"),
      }),
      "Status inválido"
    );
  });

  it("recusa quem não é membro do workspace", async () => {
    const { project, outsider } = await setup();
    actAs(outsider.id);
    expectFail(await createTaskAction({ projectId: project.id, title: "Intruso" }), "não tem acesso");
  });
});

describe("updateTaskAction", () => {
  it("grava só o que mudou e registra uma entrada de histórico por campo", async () => {
    const { project } = await setup();
    const { id } = expectOk(await createTaskAction({ projectId: project.id, title: "Original" }));
    await ChangeHistory.deleteMany({});

    expectOk(
      await updateTaskAction({
        taskId: id,
        title: "Original",
        priority: "URGENT",
        statusId: await statusId(project.id, "Revisão"),
      })
    );
    const entries = await ChangeHistory.find({ targetId: id }).lean();
    expect(entries.map((h) => h.details.field).sort()).toEqual(["priority", "status"]);
    // o histórico guarda nomes, não ids
    expect(entries.find((h) => h.details.field === "status")?.details).toMatchObject({
      oldValue: "A Fazer",
      newValue: "Revisão",
    });
  });

  it("só aceita responsável que é membro do workspace", async () => {
    const { project, member, outsider } = await setup();
    const { id } = expectOk(await createTaskAction({ projectId: project.id, title: "Atribuir" }));
    expectFail(await updateTaskAction({ taskId: id, assigneeId: outsider.id }), "membro do workspace");
    expectOk(await updateTaskAction({ taskId: id, assigneeId: member.id }));
    expect((await Task.findById(id).lean())?.assigneeId?.toString()).toBe(member.id);
  });

  it("recusa sprint de outro projeto", async () => {
    const { project, ws } = await setup();
    const other = expectOk(await createProjectAction({ workspaceId: ws.id, name: "Outro", key: "OUT" }));
    const { createSprintAction } = await import("@/server/actions/sprint.actions");
    const sprint = expectOk(await createSprintAction({ projectId: other.id, name: "Sprint do outro" }));
    const { id } = expectOk(await createTaskAction({ projectId: project.id, title: "Sprint" }));
    expectFail(await updateTaskAction({ taskId: id, sprintId: sprint.id }), "Sprint não encontrada");
  });
});

describe("exclusões e permissões de autor", () => {
  it("membro só exclui a própria tarefa; dono exclui qualquer uma", async () => {
    const { project, owner, member } = await setup();
    const ownersTask = expectOk(await createTaskAction({ projectId: project.id, title: "Do dono" }));
    actAs(member.id);
    expectFail(await deleteTaskAction({ taskId: ownersTask.id }), "Só quem criou");
    const membersTask = expectOk(await createTaskAction({ projectId: project.id, title: "Do membro" }));
    expectOk(await deleteTaskAction({ taskId: membersTask.id }));
    actAs(owner.id);
    expectOk(await deleteTaskAction({ taskId: ownersTask.id }));
    expect(await Task.countDocuments()).toBe(0);
  });

  it("membro só exclui o próprio comentário", async () => {
    const { project, owner, member } = await setup();
    const task = expectOk(await createTaskAction({ projectId: project.id, title: "Comentários" }));
    const ownersComment = expectOk(await addCommentAction({ taskId: task.id, content: "Do dono" }));
    actAs(member.id);
    expectFail(
      await deleteCommentAction({ taskId: task.id, commentId: ownersComment.id }),
      "seus comentários"
    );
    actAs(owner.id);
    expectOk(await deleteCommentAction({ taskId: task.id, commentId: ownersComment.id }));
  });

  it("marca e desmarca subtarefas", async () => {
    const { project } = await setup();
    const task = expectOk(await createTaskAction({ projectId: project.id, title: "Subtarefas" }));
    const sub = expectOk(await addSubtaskAction({ taskId: task.id, title: "Passo 1" }));
    expect(expectOk(await toggleSubtaskAction({ taskId: task.id, subtaskId: sub.id })).isCompleted).toBe(
      true
    );
    expect(expectOk(await toggleSubtaskAction({ taskId: task.id, subtaskId: sub.id })).isCompleted).toBe(
      false
    );
  });
});
