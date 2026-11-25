import { notFound } from "next/navigation";
import { getWorkspace, requireUser } from "@/lib/session";
import { getProjectByKey } from "@/server/services/project.service";
import { getTaskDetail } from "@/server/services/task.service";
import { TaskDetail } from "./task-detail";
import { aiEnabled } from "@/server/lib/ai";
import { TaskSheet } from "./task-sheet";

export type TaskParams = Promise<{ workspaceSlug: string; projectKey: string; code: string }>;

/** Busca tudo que a tela da tarefa precisa e renderiza na página ou no painel lateral. */
export async function TaskDetailLoader({
  params,
  variant,
}: {
  params: TaskParams;
  variant: "page" | "sheet";
}) {
  const { workspaceSlug, projectKey, code } = await params;
  const user = await requireUser();
  const [workspace, project, task] = await Promise.all([
    getWorkspace(workspaceSlug, user.id),
    getProjectByKey(workspaceSlug, projectKey, user.id),
    getTaskDetail(workspaceSlug, projectKey, code, user.id),
  ]);

  if (!workspace || !project || !task) notFound();

  const props = {
    task,
    statuses: project.statuses,
    sprints: project.sprints,
    members: workspace.members,
    currentUser: { id: user.id, role: workspace.currentUserRole },
    boardUrl: `/w/${workspace.slug}/projects/${project.key}`,
    aiEnabled: aiEnabled(),
  };

  return variant === "sheet" ? (
    <TaskSheet title={`${task.code} ${task.title}`} {...props} />
  ) : (
    <TaskDetail {...props} />
  );
}
