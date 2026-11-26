import "server-only";
import { priorityBadge, roleLabel, todayInBrazil, typeLabel } from "@/lib/labels";
import { getDocument } from "./document.service";
import { getMyOpenTasks } from "./my-work.service";
import { getProjectByKey } from "./project.service";
import { getTaskDetail } from "./task.service";
import { getWorkspaceBySlug } from "./workspace.service";

const VIEWS: Record<string, string> = {
  backlog: "backlog e sprints",
  list: "lista de tarefas",
  calendar: "calendário por prazo",
  reports: "relatórios",
};

const MAX_TASKS = 150;
const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

/**
 * Descreve para o assistente a tela em que a pessoa está e os dados que ela pode ver ali.
 * Tudo passa pelos services, que já conferem se a pessoa é membro: nada de fora do workspace entra.
 * Devolve null fora de /w/... ou se o workspace não existe ou a pessoa não é membro.
 */
export async function buildBuddyContext(pathname: string, userId: string) {
  const [w, slug, section, id, sub, code] = pathname.split("/").slice(1);
  if (w !== "w" || !slug) return null;
  const workspace = await getWorkspaceBySlug(slug, userId);
  if (!workspace) return null;

  const me = workspace.members.find((m) => m.id === userId);
  const today = todayInBrazil();

  const lines = [
    `Hoje: ${today}.`,
    `Workspace: ${workspace.name}. Quem pergunta: ${me?.name ?? "membro"} (${roleLabel[workspace.currentUserRole]}).`,
    `Membros: ${workspace.members.map((m) => `${m.name} (${roleLabel[m.role]})`).join(", ")}.`,
    `Projetos: ${workspace.projects.map((p) => `${p.key} ${p.name}`).join(", ") || "nenhum ainda"}.`,
  ];

  const mine = (await getMyOpenTasks(userId)).filter((t) => t.workspace.slug === slug);
  lines.push(
    "",
    "Tarefas abertas com quem pergunta:",
    ...(mine.length
      ? mine
          .slice(0, 30)
          .map(
            (t) =>
              `- ${t.code} ${t.title} · ${t.status} · ${priorityBadge[t.priority].label}${t.dueDate ? ` · prazo ${t.dueDate}` : ""}`
          )
      : ["- nenhuma"])
  );

  let screen = "visão geral do workspace";
  if (section === "settings") screen = "configurações do workspace";
  if (section === "docs") screen = "documentos";

  if (section === "docs" && id) {
    const doc = await getDocument(slug, id, userId);
    if (doc) {
      screen = `documento "${doc.title}"`;
      lines.push("", `Documento aberto: ${doc.title}`, cut(doc.content || "(vazio)", 6000));
    }
  }

  if (section === "projects" && id) {
    const project = await getProjectByKey(slug, id, userId);
    if (project) {
      screen = `projeto ${project.key} ${project.name}, ${sub === "tasks" ? "tarefa aberta" : (VIEWS[sub ?? ""] ?? "quadro kanban")}`;
      const status = new Map(project.statuses.map((s) => [s.id, s.name]));
      lines.push(
        "",
        `Projeto ${project.key} ${project.name}${project.description ? `: ${project.description}` : ""}`,
        `Colunas do quadro: ${project.statuses.map((s) => `${s.name} (${s.category})`).join(", ")}.`,
        "Sprints:",
        ...project.sprints.map(
          (s) =>
            `- ${s.name} · ${s.status}${s.startDate ? ` · ${s.startDate.slice(0, 10)} a ${s.endDate?.slice(0, 10) ?? "?"}` : ""}${s.goal ? ` · meta: ${s.goal}` : ""}`
        ),
        `Tarefas (${project.tasks.length}${project.tasks.length > MAX_TASKS ? `, mostrando ${MAX_TASKS}` : ""}):`,
        ...project.tasks
          .slice(0, MAX_TASKS)
          .map(
            (t) =>
              `- ${t.code} ${t.title} · ${typeLabel[t.type]} · ${status.get(t.statusId) ?? "?"} · ${priorityBadge[t.priority].label} · ${t.assignee?.name ?? "sem responsável"}${t.dueDate ? ` · prazo ${t.dueDate.slice(0, 10)}` : ""}${t.sprint ? ` · ${t.sprint.name}` : " · backlog"}${t.storyPoints ? ` · ${t.storyPoints} pts` : ""}`
          )
      );

      if (sub === "tasks" && code) {
        const task = await getTaskDetail(slug, project.key, code, userId);
        if (task) {
          screen = `tarefa ${task.code} ${task.title} (projeto ${project.key})`;
          lines.push(
            "",
            `Tarefa aberta: ${task.code} ${task.title}`,
            `Relator: ${task.reporter?.name ?? "?"}. Responsável: ${task.assignee?.name ?? "ninguém"}.`,
            `Descrição: ${cut(task.description || "(vazia)", 4000)}`,
            ...(task.aiSummary ? [`Resumo da IA: ${task.aiSummary}`] : []),
            "Subtarefas:",
            ...(task.subtasks.length
              ? task.subtasks.map((s) => `- [${s.isCompleted ? "x" : " "}] ${s.title}`)
              : ["- nenhuma"]),
            "Comentários (mais recentes por último):",
            ...(task.comments.length
              ? task.comments.slice(-15).map((c) => `- ${c.author?.name ?? "Alguém"}: ${cut(c.content, 800)}`)
              : ["- nenhum"])
          );
        }
      }
    }
  }

  return [`Tela atual: ${screen}.`, ...lines].join("\n");
}
