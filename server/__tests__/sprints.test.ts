import { describe, expect, it } from "vitest";
import { createProjectAction } from "@/server/actions/project.actions";
import {
  completeSprintAction,
  createSprintAction,
  startSprintAction,
  updateSprintAction,
} from "@/server/actions/sprint.actions";
import { Sprint } from "@/server/db/models";
import { actAs, createUser, createWorkspace, expectFail, expectOk } from "../../test/helpers";

async function setup() {
  const owner = await createUser("Dono");
  const member = await createUser("Membro");
  const ws = await createWorkspace(owner.id, [{ userId: member.id, role: "MEMBER" }]);
  actAs(owner.id);
  const project = expectOk(await createProjectAction({ workspaceId: ws.id, name: "Flow", key: "FL" }));
  const sprint = expectOk(await createSprintAction({ projectId: project.id, name: "Sprint 1" }));
  return { owner, member, sprint };
}

describe("updateSprintAction", () => {
  it("edita nome, meta e datas", async () => {
    const { sprint } = await setup();
    expectOk(
      await updateSprintAction({
        sprintId: sprint.id,
        name: "Lançamento",
        goal: "Publicar a v1",
        startDate: "2026-12-01",
        endDate: "2026-12-14",
      })
    );
    const saved = await Sprint.findById(sprint.id).lean();
    expect(saved?.name).toBe("Lançamento");
    expect(saved?.goal).toBe("Publicar a v1");
    expect(saved?.endDate?.toISOString()).toBe("2026-12-14T00:00:00.000Z");
  });

  it("recusa fim antes do início, membro comum e sprint concluída", async () => {
    const { owner, member, sprint } = await setup();
    const input = { sprintId: sprint.id, name: "Sprint 1", startDate: "2026-12-10", endDate: "2026-12-01" };
    expectFail(await updateSprintAction(input), "Dados inválidos");

    actAs(member.id);
    expectFail(await updateSprintAction({ sprintId: sprint.id, name: "Minha" }), "permissão");

    actAs(owner.id);
    expectOk(await startSprintAction({ sprintId: sprint.id }));
    expectOk(await completeSprintAction({ sprintId: sprint.id, moveToSprintId: null }));
    expectFail(await updateSprintAction({ sprintId: sprint.id, name: "Outra" }), "concluída");
  });
});
