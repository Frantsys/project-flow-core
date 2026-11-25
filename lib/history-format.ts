import { priorityBadge, typeLabel } from "./labels";
import type { HistoryEntryDTO, TaskPriority, TaskType } from "@/server/db/types";

const FIELD: Record<string, string> = {
  title: "o título",
  description: "a descrição",
  type: "o tipo",
  priority: "a prioridade",
  status: "o status",
  storyPoints: "os story points",
  dueDate: "o prazo",
  assignee: "o responsável",
  sprint: "a sprint",
};

/** Mostra o valor gravado no histórico como a interface mostra (Média em vez de MEDIUM). */
function value(field: string | undefined, v: string | null | undefined) {
  if (v == null || v === "") return "vazio";
  if (field === "type") return typeLabel[v as TaskType] ?? v;
  if (field === "priority") return priorityBadge[v as TaskPriority]?.label ?? v;
  if (field === "dueDate")
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${v}T00:00:00Z`));
  return v;
}

const SPRINT_STATUS: Record<string, string> = { ACTIVE: "iniciou", COMPLETED: "concluiu" };

/**
 * Frase da ação, sem o nome de quem fez: "moveu o status de A Fazer para Revisão em".
 * O alvo (details.targetTitle) é mostrado à parte pela tela.
 */
export function describeHistory(entry: HistoryEntryDTO): string {
  const { action, targetType, details } = entry;
  const { field, oldValue, newValue } = details;

  switch (targetType) {
    case "TASK":
      if (action === "CREATE") return "criou a tarefa";
      if (action === "DELETE") return "excluiu a tarefa";
      if (field === "description") return "editou a descrição de";
      if (field && FIELD[field]) {
        return `alterou ${FIELD[field]} de ${value(field, oldValue)} para ${value(field, newValue)} em`;
      }
      return "editou";
    case "SUBTASK":
      if (action === "CREATE") return `adicionou a subtarefa “${newValue}” em`;
      if (action === "DELETE") return `removeu a subtarefa “${oldValue}” de`;
      return `marcou “${oldValue}” como ${newValue} em`;
    case "COMMENT":
      return action === "DELETE" ? "excluiu um comentário em" : "comentou em";
    case "SPRINT":
      if (action === "CREATE") return "criou a sprint";
      if (action === "DELETE") return "excluiu a sprint";
      return `${SPRINT_STATUS[newValue ?? ""] ?? "alterou"} a sprint`;
    case "DOCUMENT":
      if (action === "CREATE") return "criou o documento";
      if (action === "DELETE") return "excluiu o documento";
      return field === "title" ? `renomeou “${oldValue}” para` : "editou o documento";
    case "PROJECT":
      if (action === "CREATE") return "criou o projeto";
      if (action === "DELETE") return "excluiu o projeto";
      return "editou o projeto";
  }
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/** "há 12 minutos", "ontem", "agora". */
export function timeAgo(iso: string, now = new Date()) {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "agora";
}
