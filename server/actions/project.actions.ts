"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { verifyWorkspacePermission } from "@/server/services/permission.service";
import { CreateProjectInput, createProjectSchema, DeleteProjectInput, deleteProjectSchema, UpdateProjectInput, updateProjectSchema } from "../schemas";
import { ActionResult } from "@/types";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import { ChangeHistory, Project, Sprint, Task } from "../db/models";
import z from "@/node_modules/zod/v4/classic/external.cjs";
import mongoose, { Types } from "mongoose";
import { recordChangeHistory } from "../services/change_history.service";


export async function createProjectAction(
  input: CreateProjectInput
): Promise<ActionResult<{ id: string; name: string; key: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada. Faça login novamente." };
    }

    const parsed = createProjectSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados inválidos.",
        fieldErrors:  z.flattenError(parsed.error).fieldErrors,
      };
    }

    const { workspaceId, name, key, description } = parsed.data;

    const permission = await verifyWorkspacePermission({
      workspaceId,
      userId: session.user.id,
      allowedRoles: ["OWNER", "ADMIN"],
    });

    if (!permission.authorized) {
      return { success: false, error: permission.error };
    }

    await dbConnect();

    const project = await Project.create({
      workspaceId,
      name,
      key,
      ...(description ? { description } : {}),
    });

    revalidatePath("/", "layout");

    await recordChangeHistory({
      workspaceId,
      targetType: "PROJECT",
      targetId: project._id,
      parentId: null,
      actorId: session.user.id,
      action: "CREATED",
      summary: `criou o projeto ${project.name} (${project.key})`,
      details: { key: project.key, name: project.name },
    });

    return {
      success: true,
      data: {
        id: project._id.toString(),
        name: project.name,
        key: project.key,
      },
    };
  } catch (error) {

    console.error("[createProjectAction]:", error);
    return {
      success: false,
      error: "Erro interno ao criar o projeto.",
    };
  }
}


interface UpdatedProjectLean {
  _id: Types.ObjectId;
  name: string;
  key: string;
  description?: string | null;
}




export async function updateProjectAction(
  input: UpdateProjectInput
): Promise<
  ActionResult<{
    id: string;
    name: string;
    key: string;
    description: string | null;
  }>
> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada. Faça login novamente." };
    }

    const parsed = updateProjectSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados inválidos.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    }

    const { projectId, name, description } = parsed.data;

    await dbConnect();

    const existingProject = await Project.findById(projectId)
      .select("workspaceId")
      .lean<{ _id: Types.ObjectId; workspaceId: Types.ObjectId }>();

    if (!existingProject) {
      return { success: false, error: "Projeto não encontrado." };
    }

    const permission = await verifyWorkspacePermission({
      workspaceId: existingProject.workspaceId.toString(),
      userId: session.user.id,
      allowedRoles: ["OWNER", "ADMIN"],
    });

    if (!permission.authorized) {
      return { success: false, error: permission.error };
    }

    const updateData: { name?: string; description?: string | null } = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (description !== undefined) {
      updateData.description = description || null;
    }

    const updated = await Project.findByIdAndUpdate(
      projectId,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .select("_id name key description")
      .lean<UpdatedProjectLean>();

    if (!updated) {
      return { success: false, error: "Erro ao localizar o projeto atualizado." };
    }

    revalidatePath("/", "layout");

    await recordChangeHistory({
      workspaceId: existingProject.workspaceId,
      targetType: "PROJECT",
      targetId: updated._id,
      parentId: null,
      actorId: session.user.id,
      action: "UPDATED",
      summary: `atualizou o projeto ${updated.name} (${updated.key})`,
      details: {
        key: updated.key,
        updatedFields: Object.keys(updateData),
      },
    });

    return {
      success: true,
      data: {
        id: updated._id.toString(),
        name: updated.name,
        key: updated.key,
        description: updated.description ?? null,
      },
    };
  } catch (error) {
    console.error("[updateProjectAction]:", error);
    return {
      success: false,
      error: "Erro interno ao atualizar o projeto.",
    };
  }
}


// interface essencial para que apenas o Id seja retornado em uma projeção .lean()
interface IdOnlyLean {
  _id: Types.ObjectId;
}


/**
 *  Action para excluir um projeto
 *  como essa entidade possui muitas chaves estrangeiras, e o mongodb não possui
 *  estratégia de exclusão em cascata, algumas medidas devem ser tomadas
 */
export async function deleteProjectAction(
  input: DeleteProjectInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada. Faça login novamente." };
    }

    const parsed = deleteProjectSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados inválidos.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    }

    const { projectId } = parsed.data;

    await dbConnect();


    // encontra o projeto pelo seu id e retorna também o id do workspace para validar 
    // permissões do membro
    const existingProject = await Project.findById(projectId)
      .select("workspaceId name key")
      .lean<{ _id: Types.ObjectId; workspaceId: Types.ObjectId, name: string, key: string }>();

    if (!existingProject) {
      return { success: false, error: "Projeto não encontrado." };
    }

    // apenas OWNER ou ADMIN do workspace podem excluir o projeto
    const permission = await verifyWorkspacePermission({
      workspaceId: existingProject.workspaceId.toString(),
      userId: session.user.id,
      allowedRoles: ["OWNER", "ADMIN"],
    });

    if (!permission.authorized) {
      return { success: false, error: permission.error };
    }

    // coleta IDs dos filhos para limpar também o histórico polimórfico associado a eles
    // uso de Promise.all([]) para execução de múltiplos processos assícronos ao mesmo tempo
    // resulta em melhor performance 
    const [tasks, sprints] = await Promise.all([
      Task.find({ projectId }).select("_id").lean<IdOnlyLean[]>(),
      Sprint.find({ projectId }).select("_id").lean<IdOnlyLean[]>(),
    ]);

    const relatedTargetIds: Types.ObjectId[] = [
      existingProject._id,
      ...tasks.map((t) => t._id),
      ...sprints.map((s) => s._id),
    ];

    // simulação de CASCADE
    // remove todos os registros de entidades associadas ao projeto

    // para fins de atomicidade, usa-se uma sessão mongo para iniciar uma transação
    // Benefícios: possui as características de uma transação SQL, sendo atômica e possuindo Rollback
    // Trade-Offs: aumenta considerávelmente a latência, mas para operações de importância
    // considerável e incomuns, acaba por ser o ideal.
    const mongosession = await mongoose.startSession();

    try {
      await mongosession.withTransaction(async () => {

        await Task.deleteMany({ projectId }, { session: mongosession });
        await Sprint.deleteMany({ projectId }, { session: mongosession });
        await ChangeHistory.deleteMany(
          {
            $or: [
              { parentId: existingProject._id },
              { targetId: { $in: relatedTargetIds } },
            ],
          },
          { session: mongosession }
        );

        await Project.findByIdAndDelete(projectId, { mongosession });
      });
    } finally {
      await mongosession.endSession();
    }

    revalidatePath("/", "layout");

    await recordChangeHistory({
      workspaceId: existingProject.workspaceId,
      targetType: "PROJECT",
      targetId: existingProject._id,
      parentId: null,
      actorId: session.user.id,
      action: "DELETED",
      summary: `excluiu o projeto ${existingProject.name} (${existingProject.key})`,
      details: { key: existingProject.key, name: existingProject.name },
    });

    return {
      success: true,
      data: { id: projectId },
    };
  } catch (error) {
    console.error("[deleteProjectAction]:", error);
    return {
      success: false,
      error: "Erro interno ao excluir o projeto.",
    };
  }
}