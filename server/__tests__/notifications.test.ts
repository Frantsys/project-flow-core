import { describe, expect, it, vi } from "vitest";
import { createProjectAction } from "@/server/actions/project.actions";
import {
  addCommentAction,
  createTaskAction,
  editCommentAction,
  updateTaskAction,
} from "@/server/actions/task.actions";
import { markNotificationsReadAction } from "@/server/actions/notification.actions";
import { Comment, Notification, User } from "@/server/db/models";
import { actAs, createUser, createWorkspace, expectFail, expectOk } from "../../test/helpers";

async function setup() {
  const ana = await createUser("Ana");
  const bia = await createUser("Bia");
  const caio = await createUser("Caio");
  const ws = await createWorkspace(ana.id, [
    { userId: bia.id, role: "MEMBER" },
    { userId: caio.id, role: "MEMBER" },
  ]);
  actAs(ana.id);
  const project = expectOk(await createProjectAction({ workspaceId: ws.id, name: "Avisos", key: "AV" }));
  const task = expectOk(await createTaskAction({ projectId: project.id, title: "Tarefa com avisos" }));
  return { ana, bia, caio, ws, task };
}

const inbox = async (userId: string) =>
  (await Notification.find({ userId }).sort({ createdAt: 1 }).lean()).map((n) => n.type);

describe("notificações", () => {
  it("atribuir avisa a pessoa, nunca quem atribuiu a si mesmo", async () => {
    const { ana, bia, task } = await setup();
    expectOk(await updateTaskAction({ taskId: task.id, assigneeId: bia.id }));
    expectOk(await updateTaskAction({ taskId: task.id, assigneeId: ana.id }));
    expect(await inbox(bia.id)).toEqual(["ASSIGNED"]);
    expect(await inbox(ana.id)).toEqual([]);
    const n = await Notification.findOne({ userId: bia.id }).lean();
    expect(n?.href).toMatch(/\/projects\/AV\/tasks\/AV-1$/);
  });

  it("comentário avisa menção e seguidores sem duplicar", async () => {
    const { ana, bia, caio, task } = await setup();
    expectOk(await updateTaskAction({ taskId: task.id, assigneeId: bia.id }));
    actAs(caio.id);
    // Ana criou a tarefa (seguidora) e foi mencionada: recebe só "mencionou"
    expectOk(await addCommentAction({ taskId: task.id, content: `@${ana.name} pode revisar?` }));

    expect(await inbox(ana.id)).toEqual(["MENTIONED"]);
    expect(await inbox(bia.id)).toEqual(["ASSIGNED", "COMMENTED"]);
    expect(await inbox(caio.id)).toEqual([]);
    expect((await Comment.findOne().lean())?.mentions.map(String)).toEqual([ana.id]);
  });

  it("editar avisa só quem passou a ser mencionado, e só o autor edita", async () => {
    const { ana, bia, caio, task } = await setup();
    actAs(bia.id);
    const { id } = expectOk(await addCommentAction({ taskId: task.id, content: `oi @${ana.name}` }));
    await Notification.deleteMany({});

    expectOk(
      await editCommentAction({ taskId: task.id, commentId: id, content: `oi @${ana.name} e @${caio.name}` })
    );
    expect(await inbox(ana.id)).toEqual([]);
    expect(await inbox(caio.id)).toEqual(["MENTIONED"]);
    expect((await Comment.findById(id).lean())?.editedAt).toBeInstanceOf(Date);

    actAs(ana.id);
    expectFail(
      await editCommentAction({ taskId: task.id, commentId: id, content: "mudei" }),
      "seus comentários"
    );
  });

  it("e-mail só para quem deixou ligado", async () => {
    const { bia, caio, task } = await setup();
    await User.updateOne({ _id: caio.id }, { $set: { notifyByEmail: false } });
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    expectOk(await updateTaskAction({ taskId: task.id, assigneeId: bia.id }));
    expectOk(await updateTaskAction({ taskId: task.id, assigneeId: caio.id }));
    const recipients = spy.mock.calls.map((c) => String(c[0])).filter((t) => t.startsWith("[email]"));
    spy.mockRestore();
    expect(recipients).toHaveLength(1);
    expect(recipients[0]).toContain(bia.email);
  });

  it("marcar como lida mexe só nas da própria pessoa", async () => {
    const { bia, caio, task } = await setup();
    expectOk(await updateTaskAction({ taskId: task.id, assigneeId: bia.id }));
    expectOk(await updateTaskAction({ taskId: task.id, assigneeId: caio.id }));
    const biaNote = await Notification.findOne({ userId: bia.id }).lean();

    actAs(caio.id);
    expect(expectOk(await markNotificationsReadAction({ ids: [biaNote!._id.toString()] })).updated).toBe(0);
    expect(expectOk(await markNotificationsReadAction({})).updated).toBe(1);
    expect((await Notification.findOne({ userId: bia.id }).lean())?.readAt).toBeNull();
  });
});
