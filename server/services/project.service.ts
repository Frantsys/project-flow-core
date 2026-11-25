import dbConnect from "@/lib/db";
import { Types } from "mongoose";
import { Workspace, Project, Sprint, Task } from "../db/models";
import {
  ProjectDetailsDTO,
  ProjectDTO,
  ProjectSprintSummaryDTO,
  SprintStatus,
  StatusDTO,
  TaskDTO,
  TaskPriority,
  TaskType,
} from "../db/types";

interface WorkspaceIdLean {
  _id: Types.ObjectId;
}

type StatusLean = { _id: Types.ObjectId; name: string; category: StatusDTO["category"] };

export const toStatusDTO = (s: StatusLean): StatusDTO => ({
  id: s._id.toString(),
  name: s.name,
  category: s.category,
});

interface ProjectLean {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  name: string;
  key: string;
  description?: string | null;
  statuses: StatusLean[];
  taskSequence: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Lista todos os projetos de um workspace validando se o usuário é membro.
 * Retorna `null` caso o workspace não exista ou o usuário não tenha acesso.
 */
export async function getProjectsByWorkspaceSlug(
  workspaceSlug: string,
  userId: string
): Promise<ProjectDTO[] | null> {
  if (!workspaceSlug || !Types.ObjectId.isValid(userId)) {
    return null;
  }

  await dbConnect();

  const workspace = await Workspace.findOne({
    slug: workspaceSlug.trim().toLowerCase(),
    "members.userId": userId,
  })
    .select("_id")
    .lean<WorkspaceIdLean>();

  if (!workspace) {
    return null;
  }

  const projects = await Project.find({ workspaceId: workspace._id })
    .select("_id workspaceId name key description statuses taskSequence createdAt updatedAt")
    .sort({ createdAt: 1 })
    .lean<ProjectLean[]>();

  return projects.map((project) => ({
    id: project._id.toString(),
    workspaceId: project.workspaceId.toString(),
    name: project.name,
    key: project.key,
    description: project.description ?? null,
    statuses: (project.statuses ?? []).map(toStatusDTO),
    taskSequence: project.taskSequence ?? 0,
    createdAt: new Date(project.createdAt).toISOString(),
    updatedAt: new Date(project.updatedAt).toISOString(),
  }));
}

interface ProjectBaseLean {
  _id: Types.ObjectId;
  name: string;
  key: string;
  description?: string | null;
  statuses: StatusLean[];
}

interface PopulatedTaskLean {
  _id: Types.ObjectId;
  code: string;
  title: string;
  type: TaskType;
  statusId: Types.ObjectId;
  priority: TaskPriority;
  storyPoints?: number | null;
  dueDate?: Date | null;
  sprintId?: { _id: Types.ObjectId; name: string } | null;
  assigneeId?: { _id: Types.ObjectId; username: string; image?: string | null } | null;
}

interface SprintSummaryLean {
  _id: Types.ObjectId;
  name: string;
  goal?: string;
  status: SprintStatus;
  startDate?: Date | null;
  endDate?: Date | null;
}

/**
 * Busca os detalhes completos de um projeto para montagem do quadro Kanban,
 * garantindo que o usuário autenticado seja membro do workspace.
 */
export async function getProjectByKey(
  workspaceSlug: string,
  projectKey: string,
  userId: string
): Promise<ProjectDetailsDTO | null> {
  if (!workspaceSlug || !projectKey || !Types.ObjectId.isValid(userId)) {
    return null;
  }

  await dbConnect();

  // 1. Valida acesso de membro no workspace
  const workspace = await Workspace.findOne({
    slug: workspaceSlug.trim().toLowerCase(),
    "members.userId": userId,
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!workspace) {
    return null;
  }

  // 2. Busca o projeto pela key dentro do workspace
  const project = await Project.findOne({
    workspaceId: workspace._id,
    key: projectKey.trim().toUpperCase(),
  })
    .select("_id name key description statuses")
    .lean<ProjectBaseLean>();

  if (!project) {
    return null;
  }

  // 3. Carrega tasks (com sprint e assignee populados) e sprints em paralelo
  const [rawTasks, rawSprints] = await Promise.all([
    Task.find({ projectId: project._id })
      .select("_id code title type statusId priority storyPoints dueDate sprintId assigneeId")
      .populate("sprintId", "name")
      .populate("assigneeId", "username image")
      .sort({ createdAt: 1 })
      .lean<PopulatedTaskLean[]>(),

    Sprint.find({ projectId: project._id })
      .select("name goal status startDate endDate")
      .sort({ createdAt: 1 })
      .lean<SprintSummaryLean[]>(),
  ]);

  const tasks: TaskDTO[] = rawTasks.map((task) => ({
    id: task._id.toString(),
    code: task.code,
    title: task.title,
    type: task.type,
    statusId: task.statusId.toString(),
    priority: task.priority,
    storyPoints: task.storyPoints ?? null,
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    sprint: task.sprintId ? { id: task.sprintId._id.toString(), name: task.sprintId.name } : null,
    assignee: task.assigneeId
      ? {
          id: task.assigneeId._id.toString(),
          name: task.assigneeId.username,
          image: task.assigneeId.image ?? null,
        }
      : null,
  }));

  const sprints: ProjectSprintSummaryDTO[] = rawSprints.map((sprint) => ({
    id: sprint._id.toString(),
    name: sprint.name,
    goal: sprint.goal ?? "",
    status: sprint.status,
    startDate: sprint.startDate ? new Date(sprint.startDate).toISOString() : null,
    endDate: sprint.endDate ? new Date(sprint.endDate).toISOString() : null,
  }));

  return {
    id: project._id.toString(),
    workspaceId: workspace._id.toString(),
    name: project.name,
    key: project.key,
    description: project.description ?? null,
    statuses: (project.statuses ?? []).map(toStatusDTO),
    tasks,
    sprints,
  };
}
