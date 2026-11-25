import { describe, expect, it } from "vitest";
import { projectMetrics } from "@/lib/project-metrics";
import type { ProjectDetailsDTO, TaskDTO } from "@/server/db/types";

const statuses: ProjectDetailsDTO["statuses"] = [
  { id: "todo", name: "A Fazer", category: "TODO" },
  { id: "doing", name: "Fazendo", category: "IN_PROGRESS" },
  { id: "done", name: "Feito", category: "DONE" },
  { id: "cancel", name: "Cancelado", category: "DONE" },
];
const sprint = (id: string, status: "PLANNED" | "ACTIVE" | "COMPLETED") => ({
  id,
  name: id,
  goal: "",
  status,
  startDate: null,
  endDate: null,
});
let n = 0;
const task = (over: Partial<TaskDTO>): TaskDTO => ({
  id: String(++n),
  code: `T-${n}`,
  title: "t",
  type: "TASK",
  statusId: "todo",
  rank: "",
  priority: "MEDIUM",
  storyPoints: null,
  dueDate: null,
  sprint: null,
  assignee: null,
  ...over,
});

describe("métricas do projeto", () => {
  const ana = { id: "a", name: "Ana", image: null };
  const m = projectMetrics(
    {
      statuses,
      sprints: [sprint("S1", "COMPLETED"), sprint("S2", "ACTIVE")],
      tasks: [
        task({ statusId: "done", storyPoints: 5, sprint: { id: "S1", name: "S1" } }),
        task({ statusId: "cancel", storyPoints: 3, sprint: { id: "S1", name: "S1" } }),
        task({ statusId: "done", storyPoints: 2, sprint: { id: "S2", name: "S2" } }),
        task({ statusId: "doing", storyPoints: 8, sprint: { id: "S2", name: "S2" }, assignee: ana }),
        task({ priority: "URGENT", dueDate: "2026-11-01T00:00:00.000Z", assignee: ana }),
        task({ dueDate: "2026-12-01T00:00:00.000Z" }),
      ],
    },
    "2026-11-25"
  );

  it("conta concluídas por categoria, não pelo nome nem pela última coluna", () => {
    expect([m.total, m.open, m.done]).toEqual([6, 3, 3]);
    expect(m.overdue).toBe(1);
    expect(m.byStatus.map((s) => s.value)).toEqual([2, 1, 2, 1]);
  });

  it("velocidade e sprint ativa somam só pontos concluídos", () => {
    expect(m.velocity).toEqual([{ label: "S1", value: 8 }]);
    expect(m.activeSprint).toMatchObject({ doneTasks: 1, totalTasks: 2, donePoints: 2, totalPoints: 10 });
  });

  it("responsáveis por quantidade e prioridade na ordem natural", () => {
    expect(m.byAssignee).toEqual([
      { label: "Ana", value: 2 },
      { label: "Sem responsável", value: 1 },
    ]);
    expect(m.byPriority.map((p) => p.label)).toEqual(["Urgente", "Alta", "Média", "Baixa"]);
  });
});
