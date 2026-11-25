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
export function fullDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(iso));
}
