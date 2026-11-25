import dbConnect from "@/lib/db";
import { Types } from "mongoose";
import { Project, Workspace, Sprint, Task } from "../db/models";
import { SprintStatus, TaskType, SprintWithTasksDTO, SprintTaskDTO, TaskPriority } from "../db/types";


interface SprintLean {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  name: string;
  goal?: string | null;
  status: SprintStatus;
  startDate?: Date | null;
  endDate?: Date | null;
  createdAt: Date;
}

interface PopulatedSprintTaskLean {
  _id: Types.ObjectId;
  key: string;
  title: string;
  type: TaskType;
  status: string;
  priority: TaskPriority;
  storyPoints?: number | null;
  dueDate?: Date | null;
  sprintId: Types.ObjectId;
  assigneeId?: {
    _id: Types.ObjectId;
    name: string;
    image?: string | null;
  } | null;
}

/**
 * Lista todas as sprints de um projeto com suas respectivas tarefas aninhadas,
 * validando se o usuário autenticado é membro do workspace.
 */
export async function getSprintsByProjectId(
  projectId: string,
  userId: string
): Promise<SprintWithTasksDTO[] | null> {
  if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(userId)) {
    return null;
  }

  await dbConnect();

  // 1. Resolve o projeto para obter o workspaceId
  const project = await Project.findById(projectId)
    .select("_id workspaceId")
    .lean<{ _id: Types.ObjectId; workspaceId: Types.ObjectId }>();

  if (!project) {
    return null;
  }

  // 2. Valida acesso de membro no workspace
  const isMember = await Workspace.exists({
    _id: project.workspaceId,
    "members.userId": userId,
  });

  if (!isMember) {
    return null;
  }

  // 3. Busca sprints e tarefas vinculadas a sprints em paralelo
  const [rawSprints, rawTasks] = await Promise.all([
    Sprint.find({ projectId: project._id })
      .select("_id projectId name goal status startDate endDate createdAt")
      .sort({ createdAt: 1 })
      .lean<SprintLean[]>(),

    Task.find({
      projectId: project._id,
      sprintId: { $ne: null },
    })
      .select(
        "_id key title type status priority storyPoints dueDate sprintId assigneeId"
      )
      .populate("assigneeId", "name image")
      .sort({ createdAt: 1 })
      .lean<PopulatedSprintTaskLean[]>(),
  ]);

  // 4. Agrupa as tarefas por sprintId em O(n)
  const tasksBySprint = new Map<string, SprintTaskDTO[]>();

  for (const task of rawTasks) {
    const sprintKey = task.sprintId.toString();
    const list = tasksBySprint.get(sprintKey) ?? [];

    list.push({
      id: task._id.toString(),
      code: task.key,
      title: task.title,
      type: task.type,
      status: task.status,
      priority: task.priority,
      storyPoints: task.storyPoints ?? null,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
      assignee: task.assigneeId
        ? {
            id: task.assigneeId._id.toString(),
            name: task.assigneeId.name,
            image: task.assigneeId.image ?? null,
          }
        : null,
    });

    tasksBySprint.set(sprintKey, list);
  }

  return rawSprints.map((sprint) => {
    const tasks = tasksBySprint.get(sprint._id.toString()) ?? [];

    return {
      id: sprint._id.toString(),
      projectId: sprint.projectId.toString(),
      name: sprint.name,
      goal: sprint.goal ?? null,
      status: sprint.status,
      startDate: sprint.startDate
        ? new Date(sprint.startDate).toISOString()
        : null,
      endDate: sprint.endDate ? new Date(sprint.endDate).toISOString() : null,
      tasksCount: tasks.length,
      tasks,
      createdAt: new Date(sprint.createdAt).toISOString(),
    };
  });
}


