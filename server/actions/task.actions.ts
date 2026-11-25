"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import { ActionResult } from "@/types";
import { Project, Sprint, Task, User, Workspace, WorkspaceRole } from "../db/models";
import { verifyWorkspacePermission } from "../services/permission.service";
import { recordHistory } from "../services/history.service";
import {
  addCommentSchema,
  addSubtaskSchema,
  commentRefSchema,
  CreateTaskInput,
  createTaskSchema,
  subtaskRefSchema,
  taskIdSchema,
  UpdateTaskInput,
  updateTaskSchema,
  UpdateTaskStatusInput,
  updateTaskStatusSchema,
} from "../schemas";

interface ProjectForTaskLean {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  key: string;
  statuses: string[];
}

interface TaskLean {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  code: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: string;
  storyPoints?: number | null;
  dueDate?: Date | null;
  assigneeId?: Types.ObjectId | null;
  sprintId?: Types.ObjectId | null;
  subtasks: { _id: Types.ObjectId; title: string; isCompleted: boolean; order: number }[];
  comments: { _id: Types.ObjectId; authorId: Types.ObjectId }[];
}

type Fail = { success: false; error: string; fieldErrors?: Record<string, string[]> };

const SESSION_EXPIRED: Fail = { success: false, error: "Sessão expirada. Faça login novamente." };

function invalid(error: z.ZodError): Fail {
  return { success: false, error: "Dados inválidos.", fieldErrors: z.flattenError(error).fieldErrors };
}

function revalidateProjectPages() {
  revalidatePath("/w/[workspaceSlug]/projects/[projectKey]", "layout");
}

/**
 * Carrega tarefa + projeto e confere que o usuário é membro do workspace.
 * Toda action de tarefa passa por aqui, então a regra de acesso fica num lugar só.
 */
async function loadTask(taskId: string, userId: string) {
  await dbConnect();

  const task = await Task.findById(taskId).lean<TaskLean>();
  if (!task) return { ok: false as const, error: "Tarefa não encontrada." };

  const project = await Project.findById(task.projectId)
    .select("workspaceId key statuses")
    .lean<ProjectForTaskLean>();
  if (!project) return { ok: false as const, error: "Projeto não encontrado." };

  const permission = await verifyWorkspacePermission({
    workspaceId: project.workspaceId.toString(),
    userId,
    allowedRoles: ["OWNER", "ADMIN", "MEMBER"],
  });
  if (!permission.authorized) return { ok: false as const, error: permission.error };

  const history = (
    action: "CREATE" | "MODIFY" | "DELETE",
    targetType: "TASK" | "SUBTASK" | "COMMENT",
    details: { targetTitle?: string; field?: string; oldValue?: string | null; newValue?: string | null },
    targetId: Types.ObjectId | string = task._id
  ) =>
    recordHistory({
      workspaceId: project.workspaceId,
      projectId: project._id,
      userId,
      actorRole: permission.role,
      action,
      targetType,
      targetId,
      parentId: targetType === "TASK" ? null : task._id,
      details: { targetTitle: `${task.code} ${task.title}`, ...details },
    });

  return { ok: true as const, task, project, role: permission.role as WorkspaceRole, history };
}

async function requireSession() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

/**
 * Cria uma tarefa no projeto. Qualquer membro do workspace pode criar.
 * O código (PF-12) vem do contador `taskSequence` do projeto, incrementado de forma atômica.
 */
export async function createTaskAction(
  input: CreateTaskInput
): Promise<ActionResult<{ id: string; code: string }>> {
  try {
    const userId = await requireSession();
    if (!userId) return SESSION_EXPIRED;

    const parsed = createTaskSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const { projectId, title, type, priority, storyPoints, dueDate } = parsed.data;

    await dbConnect();

    const project = await Project.findById(projectId)
      .select("workspaceId key statuses")
      .lean<ProjectForTaskLean>();

    if (!project) {
      return { success: false, error: "Projeto não encontrado." };
    }

    const permission = await verifyWorkspacePermission({
      workspaceId: project.workspaceId.toString(),
      userId,
      allowedRoles: ["OWNER", "ADMIN", "MEMBER"],
    });

    if (!permission.authorized) {
      return { success: false, error: permission.error };
    }

    const status = parsed.data.status || project.statuses[0];
    if (!status || !project.statuses.includes(status)) {
      return {
        success: false,
        error: "Status inválido para este projeto.",
        fieldErrors: { status: ["Escolha um dos status do projeto."] },
      };
    }

    // $inc é atômico: duas criações simultâneas nunca recebem o mesmo número
    const counter = await Project.findByIdAndUpdate(projectId, { $inc: { taskSequence: 1 } }, { new: true })
      .select("taskSequence")
      .lean<{ taskSequence: number }>();

    if (!counter) {
      return { success: false, error: "Projeto não encontrado." };
    }

    const code = `${project.key}-${counter.taskSequence}`;

    const task = await Task.create({
      projectId,
      reporterId: userId,
      code,
      title,
      type,
      priority,
      status,
      storyPoints: storyPoints ?? null,
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : null,
    });

    await recordHistory({
      workspaceId: project.workspaceId,
      projectId: project._id,
      userId,
      actorRole: permission.role,
      action: "CREATE",
      targetType: "TASK",
      targetId: task._id,
      details: { targetTitle: `${code} ${title}` },
    });

    revalidateProjectPages();

    return { success: true, data: { id: task._id.toString(), code } };
  } catch (error) {
    console.error("[createTaskAction]:", error);
    return { success: false, error: "Erro interno ao criar a tarefa." };
  }
}

/**
 * Move a tarefa para outro status do projeto (outra coluna do quadro)
 * e registra a mudança no histórico. Qualquer membro do workspace pode mover.
 */
export async function updateTaskStatusAction(
  input: UpdateTaskStatusInput
): Promise<ActionResult<{ id: string; status: string }>> {
  const parsed = updateTaskStatusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const result = await updateTaskAction({ taskId: parsed.data.taskId, status: parsed.data.status });
  return result.success
    ? { success: true, data: { id: parsed.data.taskId, status: parsed.data.status } }
    : result;
}

const dateOnly = (d?: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);

/**
 * Edita qualquer campo da tarefa. Só grava o que mudou e registra uma entrada de histórico por campo.
 * Responsável precisa ser membro do workspace; sprint precisa ser do mesmo projeto.
 */
export async function updateTaskAction(input: UpdateTaskInput): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireSession();
    if (!userId) return SESSION_EXPIRED;

    const parsed = updateTaskSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const data = parsed.data;

    const ctx = await loadTask(data.taskId, userId);
    if (!ctx.ok) return { success: false, error: ctx.error };
    const { task, project } = ctx;

    const set: Record<string, unknown> = {};
    const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];
    const track = (
      field: string,
      key: string,
      oldValue: unknown,
      newValue: unknown,
      label?: [string | null, string | null]
    ) => {
      if ((oldValue ?? null) === (newValue ?? null)) return;
      set[key] = newValue;
      changes.push({
        field,
        oldValue: label ? label[0] : oldValue == null ? null : String(oldValue),
        newValue: label ? label[1] : newValue == null ? null : String(newValue),
      });
    };

    if (data.title !== undefined) track("title", "title", task.title, data.title);
    if (data.description !== undefined) {
      // descrição longa: guarda só que mudou, não o texto inteiro, no histórico
      if ((task.description ?? "") !== data.description) {
        set.description = data.description;
        changes.push({ field: "description", oldValue: null, newValue: null });
      }
    }
    if (data.type !== undefined) track("type", "type", task.type, data.type);
    if (data.priority !== undefined) track("priority", "priority", task.priority, data.priority);
    if (data.storyPoints !== undefined)
      track("storyPoints", "storyPoints", task.storyPoints ?? null, data.storyPoints);
    if (data.status !== undefined) {
      if (!project.statuses.includes(data.status)) {
        return { success: false, error: "Status inválido para este projeto." };
      }
      track("status", "status", task.status, data.status);
    }
    if (data.dueDate !== undefined) {
      const oldDue = dateOnly(task.dueDate);
      if (oldDue !== data.dueDate) {
        set.dueDate = data.dueDate ? new Date(`${data.dueDate}T00:00:00.000Z`) : null;
        changes.push({ field: "dueDate", oldValue: oldDue, newValue: data.dueDate });
      }
    }

    if (data.assigneeId !== undefined) {
      const oldId = task.assigneeId?.toString() ?? null;
      if (oldId !== data.assigneeId) {
        const names = new Map<string, string>();
        if (data.assigneeId) {
          const isMember = await Workspace.exists({
            _id: project.workspaceId,
            "members.userId": data.assigneeId,
          });
          if (!isMember) return { success: false, error: "O responsável precisa ser membro do workspace." };
        }
        const ids = [oldId, data.assigneeId].filter(Boolean) as string[];
        const people = await User.find({ _id: { $in: ids } })
          .select("username")
          .lean<{ _id: Types.ObjectId; username: string }[]>();
        people.forEach((p) => names.set(p._id.toString(), p.username));
        track("assignee", "assigneeId", oldId, data.assigneeId, [
          oldId ? (names.get(oldId) ?? null) : null,
          data.assigneeId ? (names.get(data.assigneeId) ?? null) : null,
        ]);
      }
    }

    if (data.sprintId !== undefined) {
      const oldId = task.sprintId?.toString() ?? null;
      if (oldId !== data.sprintId) {
        const ids = [oldId, data.sprintId].filter(Boolean) as string[];
        const sprints = await Sprint.find({ _id: { $in: ids }, projectId: project._id })
          .select("name status")
          .lean<{ _id: Types.ObjectId; name: string; status: string }[]>();
        const target = sprints.find((s) => s._id.toString() === data.sprintId);
        if (data.sprintId && !target)
          return { success: false, error: "Sprint não encontrada neste projeto." };
        if (target?.status === "COMPLETED")
          return { success: false, error: "Não é possível adicionar tarefas a uma sprint concluída." };
        const name = (id: string | null) =>
          id ? (sprints.find((s) => s._id.toString() === id)?.name ?? null) : null;
        track("sprint", "sprintId", oldId, data.sprintId, [name(oldId), name(data.sprintId)]);
      }
    }

    if (changes.length === 0) return { success: true, data: { id: data.taskId } };

    await Task.updateOne({ _id: task._id }, { $set: set }, { runValidators: true });
    await Promise.all(changes.map((c) => ctx.history("MODIFY", "TASK", c)));

    revalidateProjectPages();
    return { success: true, data: { id: data.taskId } };
  } catch (error) {
    console.error("[updateTaskAction]:", error);
    return { success: false, error: "Erro interno ao salvar a tarefa." };
  }
}

/** Exclui a tarefa. Membros comuns só excluem tarefas que eles mesmos criaram. */
export async function deleteTaskAction(input: { taskId: string }): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireSession();
    if (!userId) return SESSION_EXPIRED;

    const parsed = taskIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const ctx = await loadTask(parsed.data.taskId, userId);
    if (!ctx.ok) return { success: false, error: ctx.error };

    const reporter = await Task.findById(ctx.task._id)
      .select("reporterId")
      .lean<{ reporterId: Types.ObjectId }>();
    if (ctx.role === "MEMBER" && reporter?.reporterId.toString() !== userId) {
      return { success: false, error: "Só quem criou a tarefa, um admin ou o dono pode excluí-la." };
    }

    await Task.deleteOne({ _id: ctx.task._id });
    await ctx.history("DELETE", "TASK", {});

    revalidateProjectPages();
    return { success: true, data: { id: parsed.data.taskId } };
  } catch (error) {
    console.error("[deleteTaskAction]:", error);
    return { success: false, error: "Erro interno ao excluir a tarefa." };
  }
}

export async function addSubtaskAction(input: {
  taskId: string;
  title: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireSession();
    if (!userId) return SESSION_EXPIRED;

    const parsed = addSubtaskSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const ctx = await loadTask(parsed.data.taskId, userId);
    if (!ctx.ok) return { success: false, error: ctx.error };

    const subtaskId = new Types.ObjectId();
    const order = ctx.task.subtasks.reduce((max, s) => Math.max(max, s.order), -1) + 1;
    await Task.updateOne(
      { _id: ctx.task._id },
      {
        $push: {
          subtasks: {
            _id: subtaskId,
            title: parsed.data.title,
            order,
            isCompleted: false,
            generatedByAi: false,
          },
        },
      }
    );
    await ctx.history("CREATE", "SUBTASK", { field: "subtask", newValue: parsed.data.title }, subtaskId);

    revalidateProjectPages();
    return { success: true, data: { id: subtaskId.toString() } };
  } catch (error) {
    console.error("[addSubtaskAction]:", error);
    return { success: false, error: "Erro interno ao adicionar a subtarefa." };
  }
}

export async function toggleSubtaskAction(input: {
  taskId: string;
  subtaskId: string;
}): Promise<ActionResult<{ isCompleted: boolean }>> {
  try {
    const userId = await requireSession();
    if (!userId) return SESSION_EXPIRED;

    const parsed = subtaskRefSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const ctx = await loadTask(parsed.data.taskId, userId);
    if (!ctx.ok) return { success: false, error: ctx.error };

    const subtask = ctx.task.subtasks.find((s) => s._id.toString() === parsed.data.subtaskId);
    if (!subtask) return { success: false, error: "Subtarefa não encontrada." };

    const isCompleted = !subtask.isCompleted;
    await Task.updateOne(
      { _id: ctx.task._id, "subtasks._id": subtask._id },
      { $set: { "subtasks.$.isCompleted": isCompleted } }
    );
    await ctx.history(
      "MODIFY",
      "SUBTASK",
      { field: "subtask", oldValue: subtask.title, newValue: isCompleted ? "concluída" : "reaberta" },
      subtask._id
    );

    revalidateProjectPages();
    return { success: true, data: { isCompleted } };
  } catch (error) {
    console.error("[toggleSubtaskAction]:", error);
    return { success: false, error: "Erro interno ao atualizar a subtarefa." };
  }
}

export async function deleteSubtaskAction(input: {
  taskId: string;
  subtaskId: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireSession();
    if (!userId) return SESSION_EXPIRED;

    const parsed = subtaskRefSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const ctx = await loadTask(parsed.data.taskId, userId);
    if (!ctx.ok) return { success: false, error: ctx.error };

    const subtask = ctx.task.subtasks.find((s) => s._id.toString() === parsed.data.subtaskId);
    if (!subtask) return { success: false, error: "Subtarefa não encontrada." };

    await Task.updateOne({ _id: ctx.task._id }, { $pull: { subtasks: { _id: subtask._id } } });
    await ctx.history("DELETE", "SUBTASK", { field: "subtask", oldValue: subtask.title }, subtask._id);

    revalidateProjectPages();
    return { success: true, data: { id: parsed.data.subtaskId } };
  } catch (error) {
    console.error("[deleteSubtaskAction]:", error);
    return { success: false, error: "Erro interno ao excluir a subtarefa." };
  }
}

export async function addCommentAction(input: {
  taskId: string;
  content: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireSession();
    if (!userId) return SESSION_EXPIRED;

    const parsed = addCommentSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const ctx = await loadTask(parsed.data.taskId, userId);
    if (!ctx.ok) return { success: false, error: ctx.error };

    const commentId = new Types.ObjectId();
    await Task.updateOne(
      { _id: ctx.task._id },
      {
        $push: {
          comments: { _id: commentId, authorId: userId, content: parsed.data.content, createdAt: new Date() },
        },
      }
    );
    await ctx.history("CREATE", "COMMENT", {}, commentId);

    revalidateProjectPages();
    return { success: true, data: { id: commentId.toString() } };
  } catch (error) {
    console.error("[addCommentAction]:", error);
    return { success: false, error: "Erro interno ao comentar." };
  }
}

/** Exclui um comentário: o autor, um admin ou o dono do workspace. */
export async function deleteCommentAction(input: {
  taskId: string;
  commentId: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireSession();
    if (!userId) return SESSION_EXPIRED;

    const parsed = commentRefSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const ctx = await loadTask(parsed.data.taskId, userId);
    if (!ctx.ok) return { success: false, error: ctx.error };

    const comment = ctx.task.comments.find((c) => c._id.toString() === parsed.data.commentId);
    if (!comment) return { success: false, error: "Comentário não encontrado." };
    if (ctx.role === "MEMBER" && comment.authorId.toString() !== userId) {
      return { success: false, error: "Você só pode excluir os seus comentários." };
    }

    await Task.updateOne({ _id: ctx.task._id }, { $pull: { comments: { _id: comment._id } } });
    await ctx.history("DELETE", "COMMENT", {}, comment._id);

    revalidateProjectPages();
    return { success: true, data: { id: parsed.data.commentId } };
  } catch (error) {
    console.error("[deleteCommentAction]:", error);
    return { success: false, error: "Erro interno ao excluir o comentário." };
  }
}
