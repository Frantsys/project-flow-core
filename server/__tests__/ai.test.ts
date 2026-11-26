import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// SDK simulado: nenhum teste chama a API de verdade (nem gasta)
const { create, parse } = vi.hoisted(() => ({ create: vi.fn(), parse: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status = 500;
  }
  class RateLimitError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    messages = { create, parse };
  }
  return { default: Anthropic };
});

import { createProjectAction } from "@/server/actions/project.actions";
import {
  addAiSubtasksAction,
  addCommentAction,
  addSubtaskAction,
  createTaskAction,
  suggestSubtasksAction,
  summarizeTaskAction,
} from "@/server/actions/task.actions";
import { Task } from "@/server/db/models";
import { actAs, createUser, createWorkspace, expectFail, expectOk } from "../../test/helpers";

async function setup() {
  const owner = await createUser("Dono");
  const ws = await createWorkspace(owner.id);
  actAs(owner.id);
  const project = expectOk(await createProjectAction({ workspaceId: ws.id, name: "IA", key: "IA" }));
  const task = expectOk(await createTaskAction({ projectId: project.id, title: "Migrar o login" }));
  return { owner, task };
}

describe("IA na tarefa", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    create.mockReset();
    parse.mockReset();
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("sem chave configurada, recusa sem chamar a API", async () => {
    const { task } = await setup();
    delete process.env.ANTHROPIC_API_KEY;
    expectFail(await summarizeTaskAction({ taskId: task.id }), "não está configurada");
    expect(create).not.toHaveBeenCalled();
  });

  it("resume com o contexto da tarefa delimitado e grava para o time", async () => {
    const { task } = await setup();
    expectOk(await addCommentAction({ taskId: task.id, content: "Falta testar no Safari" }));
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Migração quase pronta; falta testar no Safari." }],
    });

    const { summary } = expectOk(await summarizeTaskAction({ taskId: task.id }));
    expect(summary).toContain("Safari");
    expect((await Task.findById(task.id).lean())?.aiSummary).toBe(summary);

    const request = create.mock.calls[0]![0];
    expect(request.model).toBe("claude-haiku-5-5");
    expect(request.messages[0].content).toMatch(
      /<tarefa>[\s\S]*Migrar o login[\s\S]*Falta testar no Safari[\s\S]*<\/tarefa>/
    );
  });

  it("recusa do modelo vira mensagem, sem gravar nada", async () => {
    const { task } = await setup();
    create.mockResolvedValue({ stop_reason: "refusal", content: [] });
    expectFail(await summarizeTaskAction({ taskId: task.id }), "não conseguiu resumir");
    expect((await Task.findById(task.id).lean())?.aiSummary).toBeNull();
  });

  it("sugere sem repetir subtarefas e só grava as escolhidas, marcadas como IA", async () => {
    const { task } = await setup();
    expectOk(await addSubtaskAction({ taskId: task.id, title: "Escrever testes" }));
    parse.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: { subtasks: ["Escrever testes", "Mapear telas", "Trocar a biblioteca", "  "] },
    });

    const { subtasks } = expectOk(await suggestSubtasksAction({ taskId: task.id }));
    expect(subtasks).toEqual(["Mapear telas", "Trocar a biblioteca"]);
    expect((await Task.findById(task.id).lean())?.subtasks).toHaveLength(1);

    expectOk(await addAiSubtasksAction({ taskId: task.id, titles: ["Mapear telas"] }));
    const saved = (await Task.findById(task.id).lean())!.subtasks;
    expect(saved.map((s) => [s.title, s.generatedByAi])).toEqual([
      ["Escrever testes", false],
      ["Mapear telas", true],
    ]);
  });

  it("demonstração não usa a IA", async () => {
    const { owner, task } = await setup();
    actAs(owner.id, { demo: true });
    expectFail(await summarizeTaskAction({ taskId: task.id }), "demonstração");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("IA na tarefa com o Gemini", () => {
  const fetchMock = vi.fn();
  const reply = (body: unknown, status = 200) =>
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
  const text = (t: string, finishReason = "STOP") => ({
    candidates: [{ finishReason, content: { parts: [{ text: "pensando", thought: true }, { text: t }] } }],
  });

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "gemini-test-key";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    vi.unstubAllGlobals();
  });

  it("sem a chave da Anthropic, resume com o Gemini", async () => {
    const { task } = await setup();
    reply(text("Falta só o Safari."));
    const { summary } = expectOk(await summarizeTaskAction({ taskId: task.id }));
    expect(summary).toBe("Falta só o Safari.");
    expect(create).not.toHaveBeenCalled();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("gemini-3.5-flash-lite:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("gemini-test-key");
    expect(JSON.parse(init.body).contents[0].parts[0].text).toMatch(/<tarefa>[\s\S]*Migrar o login/);
  });

  it("sugere subtarefas pelo JSON estruturado, sem repetir", async () => {
    const { task } = await setup();
    expectOk(await addSubtaskAction({ taskId: task.id, title: "Escrever testes" }));
    reply(text(JSON.stringify({ subtasks: ["Escrever testes", "Mapear telas"] })));
    const { subtasks } = expectOk(await suggestSubtasksAction({ taskId: task.id }));
    expect(subtasks).toEqual(["Mapear telas"]);
    const schema = JSON.parse(fetchMock.mock.calls[0]![1].body).generationConfig.responseJsonSchema;
    expect(schema.properties.subtasks.type).toBe("array");
    expect(schema.$schema).toBeUndefined();
  });

  it("bloqueio, limite e erro do Gemini viram mensagem", async () => {
    const { task } = await setup();
    reply(text("", "SAFETY"));
    expectFail(await summarizeTaskAction({ taskId: task.id }), "não conseguiu resumir");
    reply({ error: { code: 429 } }, 429);
    expectFail(await summarizeTaskAction({ taskId: task.id }), "ocupada");
    vi.spyOn(console, "error").mockImplementation(() => {});
    reply({ error: { code: 500 } }, 500);
    expectFail(await suggestSubtasksAction({ taskId: task.id }), "não respondeu");
    reply(text("isto não é JSON"));
    expectFail(await suggestSubtasksAction({ taskId: task.id }), "não conseguiu sugerir");
  });
});
