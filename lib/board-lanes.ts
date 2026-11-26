import { priorityBadge, typeLabel } from "./labels";
import type { TaskDTO, TaskPriority, TaskType } from "@/server/db/types";

/** Como o quadro pode ser dividido em faixas (?group=). */
export const GROUP_OPTIONS = {
  assignee: "Responsável",
  priority: "Prioridade",
  type: "Tipo",
  tag: "Etiqueta",
} as const;

export type GroupBy = keyof typeof GROUP_OPTIONS;

export const parseGroupBy = (value: string | null | undefined): GroupBy | null =>
  value && value in GROUP_OPTIONS ? (value as GroupBy) : null;

export interface Lane {
  key: string;
  label: string;
  person?: { name: string; image: string | null };
}

const PRIORITIES: TaskPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];
const TYPES = ["TASK", "BUG", "STORY"] as const satisfies TaskType[];
export const NONE = "none";

/** Faixa de uma tarefa. Por etiqueta vale a primeira, para cada card aparecer uma vez só. */
export function laneOf(task: TaskDTO, by: GroupBy): string {
  if (by === "assignee") return task.assignee?.id ?? NONE;
  if (by === "priority") return task.priority;
  if (by === "type") return task.type;
  return task.tags[0]?.toLocaleLowerCase("pt-BR") ?? NONE;
}

/** Faixas na ordem de leitura; "Sem responsável" e "Sem etiqueta" ficam por último. */
export function lanesFor(tasks: TaskDTO[], by: GroupBy): Lane[] {
  if (by === "priority") return PRIORITIES.map((p) => ({ key: p, label: priorityBadge[p].label }));
  if (by === "type") return TYPES.map((t) => ({ key: t, label: typeLabel[t] }));

  const lanes = new Map<string, Lane>();
  for (const t of tasks) {
    const key = laneOf(t, by);
    if (key === NONE || lanes.has(key)) continue;
    lanes.set(
      key,
      by === "assignee"
        ? { key, label: t.assignee!.name, person: { name: t.assignee!.name, image: t.assignee!.image } }
        : { key, label: t.tags[0]! }
    );
  }
  const sorted = [...lanes.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  return [...sorted, { key: NONE, label: by === "assignee" ? "Sem responsável" : "Sem etiqueta" }];
}

/** O que muda na tarefa ao soltá-la em outra faixa (por etiqueta não muda nada). */
export function laneChange(by: GroupBy, lane: string) {
  if (by === "assignee") return { assigneeId: lane === NONE ? null : lane };
  if (by === "priority") return { priority: lane as TaskPriority };
  if (by === "type") return { type: lane as "TASK" | "BUG" | "STORY" };
  return null;
}
