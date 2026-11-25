import { Types } from "mongoose";
import { TaskDetailsDTO, TaskPriority, TaskType } from "../db/types";
import dbConnect from "@/lib/db";
import { Project, Task, Workspace } from "../db/models";

interface PopulatedUserLean {
  _id: Types.ObjectId;
  name?: string;
  username?: string;
  image?: string | null;
}

interface SubtaskLean {
  _id: Types.ObjectId;
  title: string;
  isCompleted: boolean;
  generatedByAi?: boolean;
  order?: number;
}

interface CommentLean {
  _id: Types.ObjectId;
  content: string;
  authorId: PopulatedUserLean | null;
  createdAt: Date;
}

interface PopulatedTaskDetailsLean {
  _id: Types.ObjectId;
  code: string;
  title: string;
  description?: string | null;
  type: TaskType;
  status: string;
  priority: TaskPriority;
  storyPoints?: number | string | null;
  tags?: string[]
  aiSummary?: string | null;
  dueDate?: Date | null;
  createdAt: Date;
  sprintId?: { _id: Types.ObjectId; name: string } | null;
  reporterId: PopulatedUserLean | null;
  assigneeId?: PopulatedUserLean | null;
  subtasks?: SubtaskLean[];
  comments?: CommentLean[];
}


// fallback para caso o usuário envolvido na task deixou de ser membro ou teve a conta removida
function mapUserSummary(user: PopulatedUserLean | null | undefined) {
  if (!user) {
    return {
      id: "",
      username: "Usuário removido",
      image: null,
    };
  }

  return {
    id: user._id.toString(),
    username: user.username ?? user.name ?? "Usuário",
    image: user.image ?? null,
  };
}

/**
 * Busca os detalhes completos de uma tarefa pelo seu código (ex: WEB-1),
 * garantindo isolamento de workspace, projeto e vínculo de membro.
 */
export async function getTaskDetailsByCode(
  workspaceSlug: string,
  projectKey: string,
  taskCode: string,
  userId: string
): Promise<TaskDetailsDTO | null> {
  if (
    !workspaceSlug ||
    !projectKey ||
    !taskCode ||
    !Types.ObjectId.isValid(userId)
  ) {
    return null;
  }

  await dbConnect();

  // 1. Verifica se o workspace existe e se o usuário é membro
  const workspace = await Workspace.findOne({
    slug: workspaceSlug.trim().toLowerCase(),
    "members.userId": userId,
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!workspace) {
    return null;
  }

  // 2. Verifica se o projeto pertence ao workspace
  const project = await Project.findOne({
    workspaceId: workspace._id,
    key: projectKey.trim().toUpperCase(),
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!project) {
    return null;
  }

  // 3. Busca a tarefa pelo código dentro do projeto e popula as relações
  const task = await Task.findOne({
    projectId: project._id,
    key: taskCode.trim().toUpperCase(),
  })
    .populate("sprintId", "name")
    .populate("reporterId", "name username image")
    .populate("assigneeId", "name username image")
    .populate("comments.authorId", "name username image")
    .lean<PopulatedTaskDetailsLean>();

  if (!task) {
    return null;
  }

  const subtasks = (task.subtasks ?? [])
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((subtask, index) => ({
      id: subtask._id.toString(),
      title: subtask.title,
      isCompleted: Boolean(subtask.isCompleted),
      generatedByAi: Boolean(subtask.generatedByAi),
      order: subtask.order ?? index,
    }));

  const comments = (task.comments ?? []).map((comment) => ({
    id: comment._id.toString(),
    content: comment.content,
    author: mapUserSummary(comment.authorId),
    createdAt: new Date(comment.createdAt).toISOString(),
  }));

  return {
    id: task._id.toString(),
    code: task.code,
    title: task.title,
    description: task.description ?? null,
    type: task.type,
    status: task.status,
    priority: task.priority,
    storyPoints: task.storyPoints != null ? String(task.storyPoints) : "",
    tags: task.tags ?? [],
    aiSummary: task.aiSummary ?? null,
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    createdAt: new Date(task.createdAt).toISOString(),
    sprint: task.sprintId ? { name: task.sprintId.name } : null,
    reporter: mapUserSummary(task.reporterId),
    assignee: task.assigneeId ? mapUserSummary(task.assigneeId) : null,
    subtasks,
    comments,
  };
}