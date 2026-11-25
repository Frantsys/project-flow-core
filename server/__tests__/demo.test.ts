import { describe, expect, it } from "vitest";
import { createProjectAction } from "@/server/actions/project.actions";
import { createTaskAction } from "@/server/actions/task.actions";
import { searchAction } from "@/server/actions/search.actions";
import { getUnreadCountAction } from "@/server/actions/notification.actions";
import { Task } from "@/server/db/models";
import { actAs, createUser, createWorkspace, expectFail, expectOk } from "../../test/helpers";

describe("modo demonstração", () => {
  it("lê e busca, mas não altera nada", async () => {
    const demo = await createUser("Demo");
    const ws = await createWorkspace(demo.id);
    actAs(demo.id);
    const project = expectOk(await createProjectAction({ workspaceId: ws.id, name: "Vitrine", key: "VT" }));
    expectOk(await createTaskAction({ projectId: project.id, title: "Tarefa existente" }));

    actAs(demo.id, { demo: true });
    expectFail(await createTaskAction({ projectId: project.id, title: "Nova" }), "demonstração");
    expectFail(await createProjectAction({ workspaceId: ws.id, name: "Outro", key: "OT" }), "demonstração");
    expect(await Task.countDocuments()).toBe(1);

    expect(expectOk(await searchAction({ q: "existente" }))).toHaveLength(1);
    expect(expectOk(await getUnreadCountAction({}))).toBe(0);
  });
});
