import { describe, expect, it } from "vitest";
import { laneChange, laneOf, lanesFor, NONE, parseGroupBy } from "@/lib/board-lanes";
import { viewQuery } from "@/lib/saved-views";
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

const bia = { id: "b", name: "Bia", image: null };
const ana = { id: "a", name: "Ana", image: null };

describe("faixas do quadro", () => {
  it("por responsável: em ordem alfabética e Sem responsável por último", () => {
    const tasks = [task({ assignee: bia }), task({}), task({ assignee: ana }), task({ assignee: bia })];
    expect(lanesFor(tasks, "assignee").map((l) => l.label)).toEqual(["Ana", "Bia", "Sem responsável"]);
    expect(laneOf(tasks[1]!, "assignee")).toBe(NONE);
  });

  it("por etiqueta vale a primeira, sem diferenciar maiúsculas", () => {
    const tasks = [task({ tags: ["Front", "api"] }), task({ tags: ["front"] })];
    expect(lanesFor(tasks, "tag").map((l) => l.key)).toEqual(["front", NONE]);
    expect(laneOf(tasks[1]!, "tag")).toBe("front");
  });

  it("soltar em outra faixa troca o campo certo; etiqueta não troca", () => {
    expect(laneChange("assignee", NONE)).toEqual({ assigneeId: null });
    expect(laneChange("priority", "HIGH")).toEqual({ priority: "HIGH" });
    expect(laneChange("tag", "front")).toBeNull();
    expect(parseGroupBy("qualquer")).toBeNull();
  });

  it("a query da visão ignora outros parâmetros e não depende da ordem", () => {
    const a = new URLSearchParams("type=BUG&foo=1&priority=URGENT");
    const b = new URLSearchParams("priority=URGENT&type=BUG");
    expect(viewQuery((k) => a.get(k))).toBe(viewQuery((k) => b.get(k)));
    expect(viewQuery((k) => a.get(k))).toBe("priority=URGENT&type=BUG");
  });
});
