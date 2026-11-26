import "server-only";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { Comment, Project, Task, Workspace } from "../db/models";
import { PersonDTO, TaskDetailDTO, TaskPriority, TaskType } from "../db/types";
import { findHistory } from "./history.service";

interface PersonLean {
  _id: Types.ObjectId;
  username: string;
  image?: string | null;
}

interface TaskDetailLean {
  _id: Types.ObjectId;
  code: string;
  title: string;
  description?: string;
  type: TaskType;
  statusId: Types.ObjectId;
  rank?: string;
  priority: TaskPriority;
  storyPoints?: number | null;
  tags?: string[];
  aiSummary?: string | null;
  dueDate?: Date | null;
  sprintId?: { _id: Types.ObjectId; name: string } | null;
  assigneeId?: PersonLean | null;
  reporterId?: PersonLean | null;
  subtasks: {
    _id: Types.ObjectId;
    title: string;
    isCompleted: boolean;
    generatedByAi: boolean;
    order: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const person = (p?: PersonLean | null): PersonDTO | null =>
  p ? { id: p._id.toString(), name: p.username, image: p.image ?? null } : null;

/**
 * Detalhe completo de uma tarefa pelo código (PF-12), validando que o usuário é membro do workspace.
 */
export async function getTaskDetail(
  workspaceSlug: string,
  projectKey: string,
  code: string,
  userId: string
): Promise<TaskDetailDTO | null> {
  if (!Types.ObjectId.isValid(userId)) return null;
  await dbConnect();

  const workspace = await Workspace.findOne({
    slug: workspaceSlug.trim().toLowerCase(),
    "members.userId": userId,
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();
  if (!workspace) return null;

  const project = await Project.findOne({ workspaceId: workspace._id, key: projectKey.trim().toUpperCase() })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();
  if (!project) return null;

  const task = await Task.findOne({ projectId: project._id, code: code.trim().toUpperCase() })
    .populate("sprintId", "name")
    .populate("assigneeId", "username image")
    .populate("reporterId", "username image")
    .lean<TaskDetailLean>();
  if (!task) return null;

  const [history, comments, projectTags] = await Promise.all([
    findHistory({ targetId: task._id }, 30),
    Comment.find({ taskId: task._id })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate<{ authorId: PersonLean | null }>("authorId", "username image")
      .lean(),
    Task.distinct("tags", { projectId: project._id }) as Promise<string[]>,
  ]);

  return {
    id: task._id.toString(),
    code: task.code,
    title: task.title,
    description: task.description ?? "",
    type: task.type,
    statusId: task.statusId.toString(),
    rank: task.rank ?? "",
    priority: task.priority,
    storyPoints: task.storyPoints ?? null,
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    tags: task.tags ?? [],
    projectTags: projectTags.sort((a, b) => a.localeCompare(b, "pt-BR")),
    aiSummary: task.aiSummary ?? null,
    sprint: task.sprintId ? { id: task.sprintId._id.toString(), name: task.sprintId.name } : null,
    assignee: person(task.assigneeId),
    reporter: person(task.reporterId),
    subtasks: [...task.subtasks]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        id: s._id.toString(),
        title: s.title,
        isCompleted: s.isCompleted,
        generatedByAi: s.generatedByAi,
      })),
    comments: comments.map((c) => ({
      id: c._id.toString(),
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      editedAt: c.editedAt ? c.editedAt.toISOString() : null,
      author: person(c.authorId),
    })),
    history,
    createdAt: new Date(task.createdAt).toISOString(),
    updatedAt: new Date(task.updatedAt).toISOString(),
  };
}
