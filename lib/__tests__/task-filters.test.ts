import { describe, expect, it } from "vitest";
import { collectTags, filterTasks, hasFilters, parseTaskFilters } from "@/lib/task-filters";
import type { TaskDTO } from "@/server/db/types";

const task = (over: Partial<TaskDTO>): TaskDTO => ({
  id: "t",
  code: "PF-1",
  title: "Tarefa",
  type: "TASK",
  statusId: "s",
  rank: "a0",
  priority: "MEDIUM",
  storyPoints: null,
  dueDate: null,
  tags: [],
  sprint: null,
  assignee: null,
  ...over,
});

const tasks = [
  task({
    id: "1",
    code: "PF-1",
    title: "Revisão do login",
    priority: "HIGH",
    assignee: { id: "eu", name: "Eu", image: null },
  }),
  task({ id: "2", code: "PF-2", title: "Erro no quadro", type: "BUG", tags: ["Front", "Urgente"] }),
  task({
    id: "3",
    code: "PF-3",
    title: "Página inicial",
    assignee: { id: "outra", name: "Outra", image: null },
  }),
];

const ids = (q: Record<string, string>) =>
  filterTasks(
    tasks,
    parseTaskFilters((k) => q[k]),
    "eu"
  ).map((t) => t.id);

describe("filtros de tarefa", () => {
  it("busca sem acento nem maiúscula, por título ou código", () => {
    expect(ids({ q: "revisao" })).toEqual(["1"]);
    expect(ids({ q: "pf-2" })).toEqual(["2"]);
  });

  it("filtra por responsável, prioridade e tipo, e ignora valores inválidos", () => {
    expect(ids({ assignee: "me" })).toEqual(["1"]);
    expect(ids({ assignee: "none" })).toEqual(["2"]);
    expect(ids({ assignee: "outra" })).toEqual(["3"]);
    expect(ids({ priority: "HIGH" })).toEqual(["1"]);
    expect(ids({ type: "BUG" })).toEqual(["2"]);
    expect(ids({ priority: "QUALQUER" })).toEqual(["1", "2", "3"]);
    expect(hasFilters(parseTaskFilters(() => null))).toBe(false);
  });

  it("filtra por etiqueta sem diferenciar maiúsculas e lista as etiquetas usadas", () => {
    expect(ids({ tag: "front" })).toEqual(["2"]);
    expect(ids({ tag: "nenhuma" })).toEqual([]);
    expect(collectTags(tasks)).toEqual(["Front", "Urgente"]);
  });
});
