"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { verifyWorkspacePermission } from "@/server/services/permission.service";
import { recordHistory } from "@/server/services/history.service";
import {
  CreateProjectInput,
  createProjectSchema,
  DeleteProjectInput,
  deleteProjectSchema,
  UpdateProjectInput,
  updateProjectSchema,
} from "../schemas";
import { ActionResult } from "@/types";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import { ChangeHistory, DocumentModel, Project, Sprint, Task } from "../db/models";
import { z } from "zod";
import mongoose, { Types } from "mongoose";

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
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
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

    await recordHistory({
      workspaceId,
      projectId: project._id,
      userId: session.user.id,
      actorRole: permission.role,
      action: "CREATE",
      targetType: "PROJECT",
      targetId: project._id,
      details: { targetTitle: `${project.key} · ${project.name}` },
    });

    revalidatePath("/", "layout");

    return {
      success: true,
      data: {
        id: project._id.toString(),
        name: project.name,
        key: project.key,
      },
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: number }).code === 11000
    ) {
      return {
        success: false,
        error: "Já existe um projeto com essa chave neste workspace.",
        fieldErrors: {
          key: ["Esta chave já está em uso neste workspace."],
        },
      };
    }

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

export async function updateProjectAction(input: UpdateProjectInput): Promise<
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
      .select("workspaceId key name")
      .lean<{ _id: Types.ObjectId; workspaceId: Types.ObjectId; key: string; name: string }>();

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

    await recordHistory({
      workspaceId: existingProject.workspaceId,
      projectId: existingProject._id,
      userId: session.user.id,
      actorRole: permission.role,
      action: "MODIFY",
      targetType: "PROJECT",
      targetId: existingProject._id,
      details:
        name !== undefined && name !== existingProject.name
          ? {
              targetTitle: `${updated.key} · ${updated.name}`,
              field: "name",
              oldValue: existingProject.name,
              newValue: updated.name,
            }
          : { targetTitle: `${updated.key} · ${updated.name}` },
    });

    revalidatePath("/", "layout");

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

export async function deleteProjectAction(input: DeleteProjectInput): Promise<ActionResult<{ id: string }>> {
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
      .select("workspaceId key name")
      .lean<{ _id: Types.ObjectId; workspaceId: Types.ObjectId; key: string; name: string }>();

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
    const [tasks, sprints, documents] = await Promise.all([
      Task.find({ projectId }).select("_id").lean<IdOnlyLean[]>(),
      Sprint.find({ projectId }).select("_id").lean<IdOnlyLean[]>(),
      DocumentModel.find({ projectId }).select("_id").lean<IdOnlyLean[]>(),
    ]);

    const relatedTargetIds: Types.ObjectId[] = [
      existingProject._id,
      ...tasks.map((t) => t._id),
      ...sprints.map((s) => s._id),
      ...documents.map((d) => d._id),
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
        // a opção do mongoose se chama `session`; com outro nome as operações rodavam fora da transação
        await Task.deleteMany({ projectId }, { session: mongosession });

        await Sprint.deleteMany({ projectId }, { session: mongosession });
        await DocumentModel.deleteMany({ projectId }, { session: mongosession });

        await ChangeHistory.deleteMany(
          {
            $or: [{ parentId: existingProject._id }, { targetId: { $in: relatedTargetIds } }],
          },
          { session: mongosession }
        );

        await Project.findByIdAndDelete(projectId, { session: mongosession });
      });
    } finally {
      await mongosession.endSession();
    }

    // registrado depois da transação (que apaga o histórico do projeto) e sem projectId, para ficar no feed do workspace
    await recordHistory({
      workspaceId: existingProject.workspaceId,
      projectId: null,
      userId: session.user.id,
      actorRole: permission.role,
      action: "DELETE",
      targetType: "PROJECT",
      targetId: existingProject._id,
      details: { targetTitle: `${existingProject.key} · ${existingProject.name}` },
    });

    revalidatePath("/", "layout");

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
