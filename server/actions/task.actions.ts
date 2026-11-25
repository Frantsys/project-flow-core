"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import z from "zod";

import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import { ActionResult } from "@/types";
import { ChangeHistory, Project, Task } from "../db/models";
import { verifyWorkspacePermission } from "../services/permission.service";
import { CreateTaskInput, createTaskSchema, UpdateTaskStatusInput, updateTaskStatusSchema } from "../schemas";

interface ProjectForTaskLean {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  key: string;
  statuses: string[];
}

function revalidateProjectPages() {
  revalidatePath("/w/[workspaceSlug]/projects/[projectKey]", "page");
  revalidatePath("/w/[workspaceSlug]/projects/[projectKey]/backlog", "page");
}

/**
 * Cria uma tarefa no projeto. Qualquer membro do workspace pode criar.
 * O código (PF-12) vem do contador `taskSequence` do projeto, incrementado de forma atômica.
 */
export async function createTaskAction(
  input: CreateTaskInput
): Promise<ActionResult<{ id: string; code: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada. Faça login novamente." };
    }

    const parsed = createTaskSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados inválidos.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    }

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
      userId: session.user.id,
      allowedRoles: ["OWNER", "ADMIN", "MEMBER"],
    });

    if (!permission.authorized) {
      return { success: false, error: permission.error };
    }

    const status = parsed.data.status || project.statuses[0];
    if (!project.statuses.includes(status)) {
      return {
        success: false,
        error: "Status inválido para este projeto.",
        fieldErrors: { status: ["Escolha um dos status do projeto."] },
      };
    }

    // $inc é atômico: duas criações simultâneas nunca recebem o mesmo número
    const counter = await Project.findByIdAndUpdate(
      projectId,
      { $inc: { taskSequence: 1 } },
      { new: true }
    )
      .select("taskSequence")
      .lean<{ taskSequence: number }>();

    if (!counter) {
      return { success: false, error: "Projeto não encontrado." };
    }

    const code = `${project.key}-${counter.taskSequence}`;

    const task = await Task.create({
      projectId,
      reporterId: session.user.id,
      code,
      title,
      type,
      priority,
      status,
      storyPoints: storyPoints ?? null,
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : null,
    });

    await ChangeHistory.create({
      workspaceId: project.workspaceId,
      projectId: project._id,
      userId: session.user.id,
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

interface TaskStatusLean {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  code: string;
  title: string;
  status: string;
}

/**
 * Move a tarefa para outro status do projeto (outra coluna do quadro)
 * e registra a mudança no histórico. Qualquer membro do workspace pode mover.
 */
export async function updateTaskStatusAction(
  input: UpdateTaskStatusInput
): Promise<ActionResult<{ id: string; status: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada. Faça login novamente." };
    }

    const parsed = updateTaskStatusSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados inválidos.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    }

    const { taskId, status } = parsed.data;

    await dbConnect();

    const task = await Task.findById(taskId)
      .select("projectId code title status")
      .lean<TaskStatusLean>();

    if (!task) {
      return { success: false, error: "Tarefa não encontrada." };
    }

    const project = await Project.findById(task.projectId)
      .select("workspaceId key statuses")
      .lean<ProjectForTaskLean>();

    if (!project) {
      return { success: false, error: "Projeto não encontrado." };
    }

    const permission = await verifyWorkspacePermission({
      workspaceId: project.workspaceId.toString(),
      userId: session.user.id,
      allowedRoles: ["OWNER", "ADMIN", "MEMBER"],
    });

    if (!permission.authorized) {
      return { success: false, error: permission.error };
    }

    if (!project.statuses.includes(status)) {
      return { success: false, error: "Status inválido para este projeto." };
    }

    if (task.status === status) {
      return { success: true, data: { id: taskId, status } };
    }

    await Task.updateOne({ _id: taskId }, { $set: { status } });

    await ChangeHistory.create({
      workspaceId: project.workspaceId,
      projectId: project._id,
      userId: session.user.id,
      actorRole: permission.role,
      action: "MODIFY",
      targetType: "TASK",
      targetId: task._id,
      details: {
        targetTitle: `${task.code} ${task.title}`,
        field: "status",
        oldValue: task.status,
        newValue: status,
      },
    });

    revalidateProjectPages();

    return { success: true, data: { id: taskId, status } };
  } catch (error) {
    console.error("[updateTaskStatusAction]:", error);
    return { success: false, error: "Erro interno ao mover a tarefa." };
  }
}
