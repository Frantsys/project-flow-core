"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import { ActionResult } from "@/types";
import { Project, Sprint, Task } from "../db/models";
import { verifyWorkspacePermission } from "../services/permission.service";
import { recordHistory } from "../services/history.service";
import { completeSprintSchema, CreateSprintInput, createSprintSchema, sprintIdSchema } from "../schemas";

interface ProjectLean {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  statuses: string[];
}

interface SprintLean {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  name: string;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
  startDate?: Date | null;
  endDate?: Date | null;
}

function invalid(error: z.ZodError) {
  return {
    success: false as const,
    error: "Dados inválidos.",
    fieldErrors: z.flattenError(error).fieldErrors,
  };
}

function revalidateProjectPages() {
  revalidatePath("/w/[workspaceSlug]/projects/[projectKey]", "layout");
}

const toDate = (d?: string | null) => (d ? new Date(`${d}T00:00:00.000Z`) : null);

/** Planejar, iniciar e concluir sprints é decisão de dono ou admin. */
async function authorize(projectId: Types.ObjectId | string, userId: string) {
  const project = await Project.findById(projectId).select("workspaceId statuses").lean<ProjectLean>();
  if (!project) return { ok: false as const, error: "Projeto não encontrado." };

  const permission = await verifyWorkspacePermission({
    workspaceId: project.workspaceId.toString(),
    userId,
    allowedRoles: ["OWNER", "ADMIN"],
  });
  if (!permission.authorized) return { ok: false as const, error: permission.error };

  return { ok: true as const, project, role: permission.role };
}

export async function createSprintAction(input: CreateSprintInput): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "Sessão expirada. Faça login novamente." };

    const parsed = createSprintSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    await dbConnect();
    const auth = await authorize(parsed.data.projectId, session.user.id);
    if (!auth.ok) return { success: false, error: auth.error };

    const sprint = await Sprint.create({
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      goal: parsed.data.goal ?? "",
      startDate: toDate(parsed.data.startDate),
      endDate: toDate(parsed.data.endDate),
      status: "PLANNED",
    });

    await recordHistory({
      workspaceId: auth.project.workspaceId,
      projectId: auth.project._id,
      userId: session.user.id,
      actorRole: auth.role,
      action: "CREATE",
      targetType: "SPRINT",
      targetId: sprint._id,
      details: { targetTitle: sprint.name },
    });

    revalidateProjectPages();
    return { success: true, data: { id: sprint._id.toString() } };
  } catch (error) {
    console.error("[createSprintAction]:", error);
    return { success: false, error: "Erro interno ao criar a sprint." };
  }
}

/** Inicia uma sprint planejada. Só uma sprint pode estar ativa por projeto. */
export async function startSprintAction(input: { sprintId: string }): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "Sessão expirada. Faça login novamente." };

    const parsed = sprintIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    await dbConnect();
    const sprint = await Sprint.findById(parsed.data.sprintId).lean<SprintLean>();
    if (!sprint) return { success: false, error: "Sprint não encontrada." };
    if (sprint.status !== "PLANNED")
      return { success: false, error: "Só uma sprint planejada pode ser iniciada." };

    const auth = await authorize(sprint.projectId, session.user.id);
    if (!auth.ok) return { success: false, error: auth.error };

    const active = await Sprint.exists({ projectId: sprint.projectId, status: "ACTIVE" });
    if (active)
      return { success: false, error: "Já existe uma sprint ativa. Conclua ela antes de iniciar outra." };

    await Sprint.updateOne(
      { _id: sprint._id },
      { $set: { status: "ACTIVE", startDate: sprint.startDate ?? new Date() } }
    );

    await recordHistory({
      workspaceId: auth.project.workspaceId,
      projectId: auth.project._id,
      userId: session.user.id,
      actorRole: auth.role,
      action: "MODIFY",
      targetType: "SPRINT",
      targetId: sprint._id,
      details: { targetTitle: sprint.name, field: "status", oldValue: "PLANNED", newValue: "ACTIVE" },
    });

    revalidateProjectPages();
    return { success: true, data: { id: parsed.data.sprintId } };
  } catch (error) {
    console.error("[startSprintAction]:", error);
    return { success: false, error: "Erro interno ao iniciar a sprint." };
  }
}

/**
 * Conclui a sprint ativa. Tarefas que não estão no último status do projeto (ex.: "Concluído")
 * vão para outra sprint planejada ou de volta ao backlog.
 */
export async function completeSprintAction(input: {
  sprintId: string;
  moveToSprintId: string | null;
}): Promise<ActionResult<{ moved: number }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "Sessão expirada. Faça login novamente." };

    const parsed = completeSprintSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { sprintId, moveToSprintId } = parsed.data;

    await dbConnect();
    const sprint = await Sprint.findById(sprintId).lean<SprintLean>();
    if (!sprint) return { success: false, error: "Sprint não encontrada." };
    if (sprint.status !== "ACTIVE") return { success: false, error: "Só a sprint ativa pode ser concluída." };

    const auth = await authorize(sprint.projectId, session.user.id);
    if (!auth.ok) return { success: false, error: auth.error };

    if (moveToSprintId) {
      const target = await Sprint.findOne({
        _id: moveToSprintId,
        projectId: sprint.projectId,
        status: "PLANNED",
      })
        .select("_id")
        .lean();
      if (!target) return { success: false, error: "Escolha uma sprint planejada deste projeto." };
    }

    const doneStatus = auth.project.statuses[auth.project.statuses.length - 1];
    const moved = await Task.updateMany(
      { sprintId: sprint._id, status: { $ne: doneStatus } },
      { $set: { sprintId: moveToSprintId ?? null } }
    );

    await Sprint.updateOne(
      { _id: sprint._id },
      { $set: { status: "COMPLETED", endDate: sprint.endDate ?? new Date() } }
    );

    await recordHistory({
      workspaceId: auth.project.workspaceId,
      projectId: auth.project._id,
      userId: session.user.id,
      actorRole: auth.role,
      action: "MODIFY",
      targetType: "SPRINT",
      targetId: sprint._id,
      details: { targetTitle: sprint.name, field: "status", oldValue: "ACTIVE", newValue: "COMPLETED" },
    });

    revalidateProjectPages();
    return { success: true, data: { moved: moved.modifiedCount } };
  } catch (error) {
    console.error("[completeSprintAction]:", error);
    return { success: false, error: "Erro interno ao concluir a sprint." };
  }
}

/** Exclui uma sprint que ainda não começou; as tarefas dela voltam para o backlog. */
export async function deleteSprintAction(input: { sprintId: string }): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "Sessão expirada. Faça login novamente." };

    const parsed = sprintIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    await dbConnect();
    const sprint = await Sprint.findById(parsed.data.sprintId).lean<SprintLean>();
    if (!sprint) return { success: false, error: "Sprint não encontrada." };
    if (sprint.status !== "PLANNED")
      return { success: false, error: "Só sprints planejadas podem ser excluídas." };

    const auth = await authorize(sprint.projectId, session.user.id);
    if (!auth.ok) return { success: false, error: auth.error };

    await Task.updateMany({ sprintId: sprint._id }, { $set: { sprintId: null } });
    await Sprint.deleteOne({ _id: sprint._id });

    await recordHistory({
      workspaceId: auth.project.workspaceId,
      projectId: auth.project._id,
      userId: session.user.id,
      actorRole: auth.role,
      action: "DELETE",
      targetType: "SPRINT",
      targetId: sprint._id,
      details: { targetTitle: sprint.name },
    });

    revalidateProjectPages();
    return { success: true, data: { id: parsed.data.sprintId } };
  } catch (error) {
    console.error("[deleteSprintAction]:", error);
    return { success: false, error: "Erro interno ao excluir a sprint." };
  }
}
