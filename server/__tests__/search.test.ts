import { describe, expect, it } from "vitest";
import { createProjectAction } from "@/server/actions/project.actions";
import { createTaskAction } from "@/server/actions/task.actions";
import { searchEverything, accentInsensitiveRegex } from "@/server/services/search.service";
import { actAs, createUser, createWorkspace, expectOk } from "../../test/helpers";

describe("busca global", () => {
  it("ignora acentos e só mostra o que a pessoa pode ver", async () => {
    const ana = await createUser("Ana");
    const bia = await createUser("Bia");
    const wsAna = await createWorkspace(ana.id);
    const wsBia = await createWorkspace(bia.id);

    actAs(ana.id);
    const p1 = expectOk(await createProjectAction({ workspaceId: wsAna.id, name: "Gestão", key: "GE" }));
    expectOk(await createTaskAction({ projectId: p1.id, title: "Revisão do contrato" }));
    actAs(bia.id);
    const p2 = expectOk(await createProjectAction({ workspaceId: wsBia.id, name: "Outro", key: "OU" }));
    expectOk(await createTaskAction({ projectId: p2.id, title: "Revisão secreta" }));

    const results = await searchEverything(ana.id, "revisao");
    expect(results.map((r) => r.title)).toEqual(["Revisão do contrato"]);
    expect(results[0]!.href).toBe(`/w/${wsAna.slug}/projects/GE/tasks/GE-1`);
    expect((await searchEverything(ana.id, "gestao")).map((r) => r.kind)).toEqual(["project"]);
  });

  it("trata caracteres especiais como texto", () => {
    expect(accentInsensitiveRegex("a.b(c").test("a.b(ç")).toBe(true);
    expect(accentInsensitiveRegex("a.b").test("axb")).toBe(false);
  });
});
