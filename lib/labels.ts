import type { WorkspaceRole } from "@/server/db/models";
import type { SprintStatus, TaskPriority, TaskType } from "@/server/db/types";

// Valores do banco nunca aparecem crus na interface (Design System › Conteúdo e escrita)
export const roleLabel: Record<WorkspaceRole, string> = {
  OWNER: "Dono",
  ADMIN: "Admin",
  MEMBER: "Membro",
};

export const typeLabel: Record<TaskType, string> = {
  TASK: "Tarefa",
  BUG: "Bug",
  STORY: "História",
  EPIC: "Épico",
};

export const priorityBadge: Record<
  TaskPriority,
  { label: string; variant: "muted" | "info" | "warning" | "danger" }
> = {
  LOW: { label: "Baixa", variant: "muted" },
  MEDIUM: { label: "Média", variant: "info" },
  HIGH: { label: "Alta", variant: "warning" },
  URGENT: { label: "Urgente", variant: "danger" },
};

export const sprintBadge: Record<SprintStatus, { label: string; variant: "info" | "success" | "muted" }> = {
  PLANNED: { label: "Planejada", variant: "info" },
  ACTIVE: { label: "Ativa", variant: "success" },
  COMPLETED: { label: "Concluída", variant: "muted" },
};

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0];
  if (!first) return "?";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "26 nov" em cards; "hoje" para o dia atual. */
export function shortDate(iso: string, now = new Date()) {
  const d = new Date(iso);
  const sameDay =
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate();
  return sameDay ? "hoje" : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "12/03/2026" */
/** "1 pt", "5 pts". */
export const pointsLabel = (n: number) => `${n} ${n === 1 ? "pt" : "pts"}`;

/** Data de hoje no Brasil, "AAAA-MM-DD" (o prazo das tarefas é guardado assim, sem fuso). */
export const todayInBrazil = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

export function fullDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(iso));
}

// fundo claro com texto escuro (e o inverso no tema escuro): contraste acima de 4,5:1 nas seis cores
const TAG_COLORS = [
  "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
];

/** Cor fixa por etiqueta, tirada do próprio nome: "bug" tem sempre a mesma cor em todo lugar. */
export function tagColor(tag: string) {
  let hash = 0;
  for (const ch of tag.toLocaleLowerCase("pt-BR")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length]!;
}
