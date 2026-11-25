import { priorityBadge } from "./labels";
import type { ProjectDetailsDTO, TaskPriority } from "@/server/db/types";

export interface BarDatum {
  label: string;
  value: number;
}

const PRIORITIES: TaskPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

/**
 * Números do relatório do projeto, calculados a partir das tarefas e sprints atuais.
 * shortcut: sem histórico diário, a velocidade de uma sprint concluída conta os pontos das tarefas
 * concluídas que ficaram nela (as abertas saem ao concluir); burndown precisa de snapshots (roadmap 2.6).
 */
export function projectMetrics(
  project: Pick<ProjectDetailsDTO, "statuses" | "tasks" | "sprints">,
  today: string
) {
  const doneIds = new Set(project.statuses.filter((s) => s.category === "DONE").map((s) => s.id));
  const isDone = (statusId: string) => doneIds.has(statusId);
  const open = project.tasks.filter((t) => !isDone(t.statusId));

  const byStatus: BarDatum[] = project.statuses.map((s) => ({
    label: s.name,
    value: project.tasks.filter((t) => t.statusId === s.id).length,
  }));

  const pointsDone = (sprintId: string) =>
    project.tasks
      .filter((t) => t.sprint?.id === sprintId && isDone(t.statusId))
      .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
  const velocity: BarDatum[] = project.sprints
    .filter((s) => s.status === "COMPLETED")
    .slice(-6)
    .map((s) => ({ label: s.name, value: pointsDone(s.id) }));

  const active = project.sprints.find((s) => s.status === "ACTIVE");
  const activeTasks = active ? project.tasks.filter((t) => t.sprint?.id === active.id) : [];
  const activeSprint = active
    ? {
        name: active.name,
        endDate: active.endDate,
        doneTasks: activeTasks.filter((t) => isDone(t.statusId)).length,
        totalTasks: activeTasks.length,
        donePoints: pointsDone(active.id),
        totalPoints: activeTasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0),
      }
    : null;

  const assigneeCount = new Map<string, number>();
  for (const t of open) {
    const name = t.assignee?.name ?? "Sem responsável";
    assigneeCount.set(name, (assigneeCount.get(name) ?? 0) + 1);
  }
  const byAssignee: BarDatum[] = [...assigneeCount]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));

  // ordem natural (Urgente → Baixa), não por tamanho
  const byPriority: BarDatum[] = PRIORITIES.map((p) => ({
    label: priorityBadge[p].label,
    value: open.filter((t) => t.priority === p).length,
  }));

  return {
    total: project.tasks.length,
    open: open.length,
    done: project.tasks.length - open.length,
    overdue: open.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < today).length,
    byStatus,
    velocity,
    activeSprint,
    byAssignee,
    byPriority,
  };
}
