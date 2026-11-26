import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// SDK simulado: nenhum teste chama a API de verdade
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status = 500;
  }
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = class extends APIError {};
    messages = { create, parse: vi.fn() };
  }
  return { default: Anthropic };
});

import { askBuddyAction } from "@/server/actions/buddy.actions";
import { createProjectAction } from "@/server/actions/project.actions";
import { addCommentAction, createTaskAction } from "@/server/actions/task.actions";
import { actAs, createUser, createWorkspace, expectFail, expectOk } from "../../test/helpers";

const ask = (pathname: string, content = "O que está atrasado?") =>
  askBuddyAction({ pathname, messages: [{ role: "user", content }] });

async function setup() {
  const owner = await createUser("Dona");
  const outsider = await createUser("Fora");
  const ws = await createWorkspace(owner.id);
  actAs(owner.id);
  expectOk(await createProjectAction({ workspaceId: ws.id, name: "Flow", key: "FL" }));
  const task = expectOk(
    await createTaskAction({ projectId: (await projectId(ws.id))!, title: "Migrar o login" })
  );
  expectOk(await addCommentAction({ taskId: task.id, content: "Falta o Safari" }));
  return { owner, outsider, ws, task };
}

async function projectId(workspaceId: string) {
  const { Project } = await import("@/server/db/models");
  return (await Project.findOne({ workspaceId }).lean())?._id.toString();
}

describe("assistente (buddy)", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    create.mockReset();
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Nada atrasado." }],
    });
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("responde com o contexto da tela: projeto, tarefa aberta e comentários", async () => {
    const { ws, task } = await setup();
    const { reply } = expectOk(await ask(`/w/${ws.slug}/projects/FL/tasks/${task.code}`));
    expect(reply).toBe("Nada atrasado.");

    const request = create.mock.calls[0]![0];
    expect(request.system).toMatch(/<contexto>[\s\S]*Tela atual: tarefa FL-1 Migrar o login/);
    expect(request.system).toContain("- FL-1 Migrar o login");
    expect(request.system).toMatch(/- Dona \d*: Falta o Safari/);
    expect(request.messages).toEqual([{ role: "user", content: "O que está atrasado?" }]);
  });

  it("quem não é membro não recebe nada do workspace", async () => {
    const { ws, outsider } = await setup();
    actAs(outsider.id);
    expectFail(await ask(`/w/${ws.slug}/projects/FL`), "Abra um workspace");
    expectFail(await ask("/workspaces"), "Abra um workspace");
    expect(create).not.toHaveBeenCalled();
  });

  it("recusa conversa que não termina com a pessoa e a demonstração", async () => {
    const { ws, owner } = await setup();
    expectFail(
      await askBuddyAction({ pathname: `/w/${ws.slug}`, messages: [{ role: "assistant", content: "oi" }] }),
      "Dados inválidos"
    );
    actAs(owner.id, { demo: true });
    expectFail(await ask(`/w/${ws.slug}`), "demonstração");
    expect(create).not.toHaveBeenCalled();
  });

  it("com o Gemini, manda a conversa com os papéis certos", async () => {
    const { ws } = await setup();
    delete process.env.ANTHROPIC_API_KEY;
    process.env.GEMINI_API_KEY = "g";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Oi!" }] } }] })
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const { reply } = expectOk(
        await askBuddyAction({
          pathname: `/w/${ws.slug}`,
          messages: [
            { role: "user", content: "oi" },
            { role: "assistant", content: "Olá" },
            { role: "user", content: "e agora?" },
          ],
        })
      );
      expect(reply).toBe("Oi!");
      const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
      expect(body.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model", "user"]);
      expect(body.systemInstruction.parts[0].text).toContain("Tela atual: visão geral do workspace");
    } finally {
      delete process.env.GEMINI_API_KEY;
      vi.unstubAllGlobals();
    }
  });
});
