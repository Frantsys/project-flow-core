import { describe, expect, it } from "vitest";
import { createProjectAction, deleteProjectAction } from "@/server/actions/project.actions";
import { deleteViewAction, saveViewAction } from "@/server/actions/view.actions";
import { getRecentNotificationsAction } from "@/server/actions/notification.actions";
import { SavedView } from "@/server/db/models";
import { getSavedViews } from "@/server/services/view.service";
import { actAs, createUser, createWorkspace, expectFail, expectOk } from "../../test/helpers";

async function setup() {
  const owner = await createUser("Dono");
  const member = await createUser("Membro");
  const outsider = await createUser("Fora");
  const ws = await createWorkspace(owner.id, [{ userId: member.id, role: "MEMBER" }]);
  actAs(owner.id);
  const project = expectOk(await createProjectAction({ workspaceId: ws.id, name: "Visões", key: "VS" }));
  return { owner, member, outsider, project };
}

describe("visões salvas", () => {
  it("guarda só os filtros conhecidos e cada pessoa vê as suas", async () => {
    const { owner, member, project } = await setup();
    actAs(member.id);
    const view = expectOk(
      await saveViewAction({
        projectId: project.id,
        name: "Bugs urgentes",
        query: "type=BUG&x=1&priority=URGENT",
      })
    );
    expect(view.query).toBe("priority=URGENT&type=BUG");
    expect(await getSavedViews(project.id, member.id)).toHaveLength(1);
    expect(await getSavedViews(project.id, owner.id)).toHaveLength(0);
    expectFail(await saveViewAction({ projectId: project.id, name: "Vazia", query: "x=1" }), "algum filtro");
  });

  it("quem é de fora não salva, e ninguém exclui a visão de outra pessoa", async () => {
    const { owner, member, outsider, project } = await setup();
    actAs(outsider.id);
    expectFail(await saveViewAction({ projectId: project.id, name: "X", query: "type=BUG" }), "");
    actAs(member.id);
    const view = expectOk(
      await saveViewAction({ projectId: project.id, name: "Minhas", query: "assignee=me" })
    );
    actAs(owner.id);
    expectFail(await deleteViewAction({ viewId: view.id }), "não encontrada");
    actAs(member.id);
    expectOk(await deleteViewAction({ viewId: view.id }));
  });

  it("excluir o projeto apaga as visões dele", async () => {
    const { owner, project } = await setup();
    expectOk(await saveViewAction({ projectId: project.id, name: "Grupo", query: "group=assignee" }));
    actAs(owner.id);
    expectOk(await deleteProjectAction({ projectId: project.id }));
    expect(await SavedView.countDocuments({ projectId: project.id })).toBe(0);
  });

  it("o painel do sino traz as notificações recentes da pessoa", async () => {
    const { member } = await setup();
    actAs(member.id);
    expect(expectOk(await getRecentNotificationsAction({}))).toEqual([]);
  });
});
