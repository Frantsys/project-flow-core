import "server-only";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { Project, Task, Workspace } from "../db/models";
import type { TaskPriority, TaskType } from "../db/types";

export interface MyTaskDTO {
  id: string;
  code: string;
  title: string;
  type: TaskType;
  priority: TaskPriority;
  status: string;
  /** "AAAA-MM-DD" ou null. */
  dueDate: string | null;
  project: { name: string; key: string };
  workspace: { name: string; slug: string };
  href: string;
}

/** Tarefas abertas (fora de status "Concluído") atribuídas à pessoa, em todos os workspaces. */
export async function getMyOpenTasks(userId: string): Promise<MyTaskDTO[]> {
  if (!Types.ObjectId.isValid(userId)) return [];
  await dbConnect();

  const workspaces = await Workspace.find({ "members.userId": userId }).select("name slug").lean();
  const projects = await Project.find({ workspaceId: { $in: workspaces.map((w) => w._id) } })
    .select("workspaceId name key statuses")
    .lean();
  const wsById = new Map(workspaces.map((w) => [w._id.toString(), w]));
  const projectById = new Map(projects.map((p) => [p._id.toString(), p]));
  const doneIds = projects.flatMap((p) => p.statuses.filter((s) => s.category === "DONE").map((s) => s._id));

  const tasks = await Task.find({
    assigneeId: userId,
    projectId: { $in: projects.map((p) => p._id) },
    statusId: { $nin: doneIds },
  })
    .select("projectId code title type priority statusId dueDate")
    .sort({ dueDate: 1, createdAt: 1 })
    .limit(300)
    .lean();

  return tasks.flatMap((t) => {
    const project = projectById.get(t.projectId.toString());
    const ws = project && wsById.get(project.workspaceId.toString());
    if (!project || !ws) return [];
    return [
      {
        id: t._id.toString(),
        code: t.code,
        title: t.title,
        type: t.type,
        priority: t.priority,
        status: project.statuses.find((s) => s._id.equals(t.statusId))?.name ?? "",
        dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
        project: { name: project.name, key: project.key },
        workspace: { name: ws.name, slug: ws.slug },
        href: `/w/${ws.slug}/projects/${project.key}/tasks/${t.code}`,
      },
    ];
  });
}

/** Agrupa por prazo em relação a `today` ("AAAA-MM-DD"). */
export function groupByDue(tasks: MyTaskDTO[], today: string) {
  const week = new Date(`${today}T00:00:00Z`);
  week.setUTCDate(week.getUTCDate() + 7);
  const weekEnd = week.toISOString().slice(0, 10);
  const groups = [
    { id: "overdue", label: "Atrasadas", tasks: [] as MyTaskDTO[] },
    { id: "today", label: "Hoje", tasks: [] as MyTaskDTO[] },
    { id: "week", label: "Próximos 7 dias", tasks: [] as MyTaskDTO[] },
    { id: "later", label: "Depois", tasks: [] as MyTaskDTO[] },
    { id: "none", label: "Sem prazo", tasks: [] as MyTaskDTO[] },
  ];
  for (const t of tasks) {
    const i = !t.dueDate ? 4 : t.dueDate < today ? 0 : t.dueDate === today ? 1 : t.dueDate <= weekEnd ? 2 : 3;
    groups[i]!.tasks.push(t);
  }
  return groups.filter((g) => g.tasks.length > 0);
}
