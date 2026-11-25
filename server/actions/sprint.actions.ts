"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { ChangeHistory, Project, Sprint, Task } from "../db/models";
import { verifyWorkspacePermission } from "../services/permission.service";
import { CreateSprintInput, createSprintSchema, DeleteSprintInput, deleteSprintSchema, UpdateSprintInput, updateSprintSchema } from "../schemas";
import { ActionResult } from "@/types";
import { SprintStatus } from "../db/types";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import z from "zod";
import { recordChangeHistory } from "../services/change_history.service";
import { notifyWorkspace } from "../notifications";


async function resolveAdminProjectAccess(projectId: Types.ObjectId | string, userId: string) {
  const project = await Project.findById(projectId)
    .select("_id workspaceId")
    .lean<{ _id: Types.ObjectId; workspaceId: Types.ObjectId }>();

  if (!project) {
    return { ok: false as const, error: "Projeto não encontrado." };
  }

  const permission = await verifyWorkspacePermission({
    workspaceId: project.workspaceId.toString(),
    userId,
    allowedRoles: ["OWNER", "ADMIN"],
  });

  if (!permission.authorized) {
    return { ok: false as const, error: permission.error };
  }

  return { ok: true as const, project };
}

export async function createSprintAction(
  input: CreateSprintInput
): Promise<ActionResult<{ id: string; name: string; status: SprintStatus }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada." };
    }

    const parsed = createSprintSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados inválidos.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    }

    await dbConnect();

    const access = await resolveAdminProjectAccess(parsed.data.projectId, session.user.id);
    if (!access.ok) return { success: false, error: access.error };

    const sprint = await Sprint.create({
      projectId: access.project._id,
      name: parsed.data.name,
      goal: parsed.data.goal ?? "",
      status: "PLANNED",
      startDate: parsed.data.startDate ?? null,
      endDate: parsed.data.endDate ?? null,
    });

    revalidatePath("/", "layout");

    await recordChangeHistory({
        workspaceId: access.project.workspaceId,
        targetType: "SPRINT",
        targetId: sprint._id,
        parentId: access.project._id,
        actorId: session.user.id,
        action: "CREATED",
        summary: `criou a sprint ${sprint.name}`,
        details: { name: sprint.name, status: sprint.status },
    }); 

    return {
      success: true,
      data: {
        id: sprint._id.toString(),
        name: sprint.name,
        status: sprint.status,
      },
    };
  } catch (error) {
    console.error("[createSprintAction]:", error);
    return { success: false, error: "Erro interno ao criar sprint." };
  }
}

export async function updateSprintAction(
  input: UpdateSprintInput
): Promise<ActionResult<{ id: string; name: string; status: SprintStatus }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada." };
    }

    const parsed = updateSprintSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados inválidos.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    }

    const { sprintId, name, goal, status, startDate, endDate } = parsed.data;

    await dbConnect();

    const existingSprint = await Sprint.findById(sprintId)
      .select("_id projectId")
      .lean<{ _id: Types.ObjectId; projectId: Types.ObjectId }>();

    if (!existingSprint) {
      return { success: false, error: "Sprint não encontrada." };
    }

    const access = await resolveAdminProjectAccess(existingSprint.projectId, session.user.id);
    if (!access.ok) return { success: false, error: access.error };

    // Garante apenas 1 sprint ACTIVE por projeto
    if (status === "ACTIVE") {
      const hasOtherActive = await Sprint.exists({
        projectId: existingSprint.projectId,
        _id: { $ne: existingSprint._id },
        status: "ACTIVE",
      });

      if (hasOtherActive) {
        return {
          success: false,
          error: "Já existe uma sprint ativa neste projeto. Conclua-a antes de iniciar outra.",
        };
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (goal !== undefined) updateData.goal = goal;
    if (status !== undefined) updateData.status = status;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (endDate !== undefined) updateData.endDate = endDate;

    const updated = await Sprint.findByIdAndUpdate(
      sprintId,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .select("_id name status")
      .lean<{ _id: Types.ObjectId; name: string; status: SprintStatus }>();

    if (!updated) {
      return { success: false, error: "Erro ao localizar sprint atualizada." };
    }

    revalidatePath("/", "layout");


    const sprintSummary = status === "ACTIVE" ? `iniciou a sprint ${updated.name}`
    : status === "COMPLETED"
      ? `concluiu a sprint ${updated.name}`
      : `atualizou a sprint ${updated.name}`;

    await recordChangeHistory({
        workspaceId: access.project.workspaceId,
        targetType: "SPRINT",
        targetId: updated._id,
        parentId: access.project._id,
        actorId: session.user.id,
        action: status !== undefined ? "STATUS_CHANGED" : "UPDATED",
        summary: sprintSummary,
        details: { name: updated.name, status: updated.status },
    });

    return {
      success: true,
      data: {
        id: updated._id.toString(),
        name: updated.name,
        status: updated.status,
      },
    };
  } catch (error) {
    console.error("[updateSprintAction]:", error);
    return { success: false, error: "Erro interno ao atualizar sprint." };
  }
}

export async function deleteSprintAction(
  input: DeleteSprintInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada." };
    }

    const parsed = deleteSprintSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Dados inválidos." };
    }

    await dbConnect();

    const existingSprint = await Sprint.findById(parsed.data.sprintId)
      .select("_id projectId name ")
      .lean<{ _id: Types.ObjectId; projectId: Types.ObjectId, name: string }>();

    if (!existingSprint) {
      return { success: false, error: "Sprint não encontrada." };
    }

    const access = await resolveAdminProjectAccess(existingSprint.projectId, session.user.id);
    if (!access.ok) return { success: false, error: access.error };

    // Desvincula as tarefas (devolve ao backlog) e limpa logs polimórficos
    await Promise.all([
      Task.updateMany(
        { sprintId: existingSprint._id },
        { $set: { sprintId: null } }
      ),
      ChangeHistory.deleteMany({ targetId: existingSprint._id }),
    ]);

    await Sprint.findByIdAndDelete(existingSprint._id);

    revalidatePath("/", "layout");


    await recordChangeHistory({
        workspaceId: access.project.workspaceId,
        targetType: "SPRINT",
        targetId: existingSprint._id,
        parentId: access.project._id,
        actorId: session.user.id,
        action: "DELETED",
        summary: `excluiu a sprint ${existingSprint.name}`,
        details: { name: existingSprint.name },
    });

    return { success: true, data: { id: parsed.data.sprintId } };
  } catch (error) {
    console.error("[deleteSprintAction]:", error);
    return { success: false, error: "Erro interno ao excluir sprint." };
  }
}