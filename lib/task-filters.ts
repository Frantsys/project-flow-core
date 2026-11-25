import type { TaskDTO, TaskPriority, TaskType } from "@/server/db/types";

/** Filtros do quadro e do backlog, guardados na URL para poderem ser compartilhados por link. */
export interface TaskFilters {
  q: string;
  /** "me" = minhas, "none" = sem responsável, ou o id de uma pessoa. */
  assignee: string | null;
  priority: TaskPriority | null;
  type: TaskType | null;
}

const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const TYPES: TaskType[] = ["TASK", "BUG", "STORY"];

const oneOf = <T extends string>(value: string | null | undefined, options: T[]) =>
  options.includes(value as T) ? (value as T) : null;

export function parseTaskFilters(get: (key: string) => string | null | undefined): TaskFilters {
  return {
    q: (get("q") ?? "").trim().slice(0, 100),
    assignee: get("assignee") || null,
    priority: oneOf(get("priority"), PRIORITIES),
    type: oneOf(get("type"), TYPES),
  };
}

export const hasFilters = (f: TaskFilters) => !!(f.q || f.assignee || f.priority || f.type);

// busca sem diferenciar maiúsculas nem acentos ("revisao" encontra "Revisão")
export const normalizeText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function filterTasks(tasks: TaskDTO[], f: TaskFilters, currentUserId: string) {
  const q = normalizeText(f.q);
  return tasks.filter((t) => {
    if (q && !normalizeText(`${t.code} ${t.title}`).includes(q)) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.type && t.type !== f.type) return false;
    if (f.assignee === "me" && t.assignee?.id !== currentUserId) return false;
    if (f.assignee === "none" && t.assignee) return false;
    if (f.assignee && f.assignee !== "me" && f.assignee !== "none" && t.assignee?.id !== f.assignee)
      return false;
    return true;
  });
}
