import { describe, expect, it } from "vitest";
import { GET as getProjects } from "@/app/api/v1/projects/route";
import { GET as getTasks } from "@/app/api/v1/projects/[key]/tasks/route";
import { GET as getTask } from "@/app/api/v1/projects/[key]/tasks/[code]/route";
import { createApiTokenAction, revokeApiTokenAction } from "@/server/actions/api-token.actions";
import { createProjectAction } from "@/server/actions/project.actions";
import { addSubtaskAction, createTaskAction } from "@/server/actions/task.actions";
import { ApiToken } from "@/server/db/models";
import { actAs, createUser, createWorkspace, expectFail, expectOk } from "../../test/helpers";

const call = (token: string | null, path = "/api/v1/projects") =>
  new Request(`http://localhost${path}`, token ? { headers: { authorization: `Bearer ${token}` } } : {});
const params = <T>(value: T) => ({ params: Promise.resolve(value) });

async function setup() {
  const owner = await createUser("Dono");
  const member = await createUser("Membro");
  const ws = await createWorkspace(owner.id, [{ userId: member.id, role: "MEMBER" }]);
  const other = await createWorkspace(owner.id);
  actAs(owner.id);
  const project = expectOk(await createProjectAction({ workspaceId: ws.id, name: "Público", key: "PUB" }));
  expectOk(await createProjectAction({ workspaceId: other.id, name: "Outro", key: "OUT" }));
  const task = expectOk(await createTaskAction({ projectId: project.id, title: "Integrar com a planilha" }));
  expectOk(await addSubtaskAction({ taskId: task.id, title: "Gerar token" }));
  const { token } = expectOk(await createApiTokenAction({ workspaceId: ws.id, name: "Planilha" }));
  return { owner, member, ws, token };
}

describe("API pública v1", () => {
  it("só dono e admin criam tokens; o banco guarda só o hash", async () => {
    const { member, ws, token } = await setup();
    expect(token).toMatch(/^pf_/);
    const saved = await ApiToken.findOne().lean();
    expect(saved?.tokenHash).not.toBe(token);
    expect(token.startsWith(saved!.prefix)).toBe(true);
    actAs(member.id);
    expectFail(await createApiTokenAction({ workspaceId: ws.id, name: "Meu" }), "permissão");
  });

  it("lê projetos e tarefas só do workspace do token", async () => {
    const { token } = await setup();
    const projects = await (await getProjects(call(token))).json();
    expect(projects.data.map((p: { key: string }) => p.key)).toEqual(["PUB"]);

    const tasksRes = await getTasks(
      call(token, "/api/v1/projects/pub/tasks?limit=10"),
      params({ key: "pub" })
    );
    const tasks = await tasksRes.json();
    expect(tasks.data[0]).toMatchObject({ code: "PUB-1", status: "A Fazer", statusCategory: "TODO" });
    expect(tasks.pagination).toEqual({ total: 1, limit: 10, offset: 0 });

    const one = await (await getTask(call(token), params({ key: "PUB", code: "pub-1" }))).json();
    expect(one.data.subtasks).toEqual([{ title: "Gerar token", done: false }]);

    // projeto de outro workspace do mesmo dono: invisível para este token
    const res = await getTasks(call(token, "/api/v1/projects/OUT/tasks"), params({ key: "OUT" }));
    expect(res.status).toBe(404);
  });

  it("recusa sem token, com token inválido e depois de revogado", async () => {
    const { ws, token } = await setup();
    expect((await getProjects(call(null))).status).toBe(401);
    expect((await getProjects(call("pf_tokenquenaoexiste_000000"))).status).toBe(401);

    const saved = await ApiToken.findOne().lean();
    expectOk(await revokeApiTokenAction({ workspaceId: ws.id, tokenId: saved!._id.toString() }));
    expect((await getProjects(call(token))).status).toBe(401);
  });
});
