import "server-only";
import { Types } from "mongoose";
import { ApiToken, Project, Task } from "../db/models";

/**
 * Formato público da API v1. Separado dos DTOs da interface: o que sai daqui é contrato com
 * integrações externas e só muda com versão nova. Sem e-mails: pessoas aparecem só pelo nome.
 */

type StatusLean = { _id: Types.ObjectId; name: string; category: string };

export async function listProjects(workspaceId: Types.ObjectId) {
  const projects = await Project.find({ workspaceId }).sort({ createdAt: 1 }).lean();
  return projects.map((p) => ({
    key: p.key,
    name: p.name,
    description: p.description ?? "",
    statuses: (p.statuses as StatusLean[]).map((s) => ({ name: s.name, category: s.category })),
    createdAt: p.createdAt.toISOString(),
  }));
}

function taskJson(t: Record<string, unknown> & { _id: Types.ObjectId }, statuses: StatusLean[]) {
  const status = statuses.find((s) => s._id.equals(t.statusId as Types.ObjectId));
  const assignee = t.assigneeId as { username: string } | null;
  const sprint = t.sprintId as { name: string } | null;
  return {
    code: t.code as string,
    title: t.title as string,
    type: t.type as string,
    status: status?.name ?? null,
    statusCategory: status?.category ?? null,
    priority: t.priority as string,
    storyPoints: (t.storyPoints as number | null) ?? null,
    dueDate: t.dueDate ? (t.dueDate as Date).toISOString().slice(0, 10) : null,
    assignee: assignee ? { name: assignee.username } : null,
    sprint: sprint ? { name: sprint.name } : null,
    createdAt: (t.createdAt as Date).toISOString(),
    updatedAt: (t.updatedAt as Date).toISOString(),
  };
}

async function findProject(workspaceId: Types.ObjectId, key: string) {
  return Project.findOne({ workspaceId, key: key.toUpperCase() }).select("_id statuses").lean();
}

export async function listTasks(
  workspaceId: Types.ObjectId,
  key: string,
  { status, limit, offset }: { status: string | null; limit: number; offset: number }
) {
  const project = await findProject(workspaceId, key);
  if (!project) return null;
  const statuses = project.statuses as StatusLean[];
  const filter: Record<string, unknown> = { projectId: project._id };
  if (status) {
    const match = statuses.find((s) => s.name.toLowerCase() === status.toLowerCase());
    if (!match) return { tasks: [], total: 0 };
    filter.statusId = match._id;
  }
  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .sort({ createdAt: 1 })
      .skip(offset)
      .limit(limit)
      .populate("assigneeId", "username")
      .populate("sprintId", "name")
      .lean(),
    Task.countDocuments(filter),
  ]);
  return { tasks: tasks.map((t) => taskJson(t as never, statuses)), total };
}

export async function getTask(workspaceId: Types.ObjectId, key: string, code: string) {
  const project = await findProject(workspaceId, key);
  if (!project) return null;
  const task = await Task.findOne({ projectId: project._id, code: code.toUpperCase() })
    .populate("assigneeId", "username")
    .populate("sprintId", "name")
    .lean();
  if (!task) return null;
  return {
    ...taskJson(task as never, project.statuses as StatusLean[]),
    description: task.description ?? "",
    subtasks: task.subtasks.map((s) => ({ title: s.title, done: s.isCompleted })),
  };
}

export interface ApiTokenDTO {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Tokens do workspace para a tela de configurações (nunca o valor, que nem é guardado). */
export async function listApiTokens(workspaceId: string): Promise<ApiTokenDTO[]> {
  const tokens = await ApiToken.find({ workspaceId }).sort({ createdAt: -1 }).lean();
  return tokens.map((t) => ({
    id: t._id.toString(),
    name: t.name,
    prefix: t.prefix,
    createdAt: t.createdAt.toISOString(),
    lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
  }));
}
