import type { TaskDTO, TaskPriority, TaskType } from "@/server/db/types";

/** Filtros do quadro e do backlog, guardados na URL para poderem ser compartilhados por link. */
export interface TaskFilters {
  q: string;
  /** "me" = minhas, "none" = sem responsável, ou o id de uma pessoa. */
  assignee: string | null;
  priority: TaskPriority | null;
  type: TaskType | null;
  tag: string | null;
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
    tag: get("tag")?.trim().slice(0, 30) || null,
  };
}

export const hasFilters = (f: TaskFilters) => !!(f.q || f.assignee || f.priority || f.type || f.tag);

/** Etiquetas usadas nas tarefas, sem repetir, em ordem alfabética (para o filtro). */
export const collectTags = (tasks: Pick<TaskDTO, "tags">[]) =>
  [...new Set(tasks.flatMap((t) => t.tags))].sort((a, b) => a.localeCompare(b, "pt-BR"));

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
    if (f.tag && !t.tags.some((tag) => normalizeText(tag) === normalizeText(f.tag!))) return false;
    if (f.assignee === "me" && t.assignee?.id !== currentUserId) return false;
    if (f.assignee === "none" && t.assignee) return false;
    if (f.assignee && f.assignee !== "me" && f.assignee !== "none" && t.assignee?.id !== f.assignee)
      return false;
    return true;
  });
}
