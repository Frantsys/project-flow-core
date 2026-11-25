"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import { ActionResult } from "@/types";
import { DocumentModel, Project } from "../db/models";
import { verifyWorkspacePermission } from "../services/permission.service";
import { recordHistory } from "../services/history.service";
import { createDocumentSchema, documentIdSchema, updateDocumentSchema } from "../schemas";

interface DocLean {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  projectId?: Types.ObjectId | null;
  title: string;
}

function invalid(error: z.ZodError) {
  return {
    success: false as const,
    error: "Dados inválidos.",
    fieldErrors: z.flattenError(error).fieldErrors,
  };
}

function revalidateDocs() {
  revalidatePath("/w/[workspaceSlug]/docs", "layout");
}

/** Qualquer membro do workspace pode criar, editar e excluir documentos. */
async function member(workspaceId: string, userId: string) {
  return verifyWorkspacePermission({ workspaceId, userId, allowedRoles: ["OWNER", "ADMIN", "MEMBER"] });
}

export async function createDocumentAction(input: {
  workspaceId: string;
  parentId?: string | null;
  projectId?: string | null;
  title?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "Sessão expirada. Faça login novamente." };

    const parsed = createDocumentSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { workspaceId, parentId, title } = parsed.data;
    let projectId = parsed.data.projectId ?? null;

    const permission = await member(workspaceId, session.user.id);
    if (!permission.authorized) return { success: false, error: permission.error };

    await dbConnect();

    if (parentId) {
      const parent = await DocumentModel.findOne({ _id: parentId, workspaceId })
        .select("projectId")
        .lean<DocLean>();
      if (!parent) return { success: false, error: "Documento pai não encontrado." };
      projectId = parent.projectId?.toString() ?? null; // subdocumento fica no mesmo projeto do pai
    }
    if (projectId && !(await Project.exists({ _id: projectId, workspaceId }))) {
      return { success: false, error: "Projeto não encontrado neste workspace." };
    }

    const doc = await DocumentModel.create({
      workspaceId,
      projectId,
      parentDocId: parentId ?? null,
      authorId: session.user.id,
      title: title || "Sem título",
      content: "",
    });

    await recordHistory({
      workspaceId,
      projectId,
      userId: session.user.id,
      actorRole: permission.role,
      action: "CREATE",
      targetType: "DOCUMENT",
      targetId: doc._id,
      details: { targetTitle: doc.title },
    });

    revalidateDocs();
    return { success: true, data: { id: doc._id.toString() } };
  } catch (error) {
    console.error("[createDocumentAction]:", error);
    return { success: false, error: "Erro interno ao criar o documento." };
  }
}

export async function updateDocumentAction(input: {
  documentId: string;
  title: string;
  content: string;
}): Promise<ActionResult<{ updatedAt: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "Sessão expirada. Faça login novamente." };

    const parsed = updateDocumentSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { documentId, title, content } = parsed.data;

    await dbConnect();
    const doc = await DocumentModel.findById(documentId)
      .select("workspaceId projectId title")
      .lean<DocLean>();
    if (!doc) return { success: false, error: "Documento não encontrado." };

    const permission = await member(doc.workspaceId.toString(), session.user.id);
    if (!permission.authorized) return { success: false, error: permission.error };

    const updated = await DocumentModel.findByIdAndUpdate(
      documentId,
      { $set: { title, content } },
      { new: true, runValidators: true }
    )
      .select("updatedAt")
      .lean<{ updatedAt: Date }>();

    await recordHistory({
      workspaceId: doc.workspaceId,
      projectId: doc.projectId ?? null,
      userId: session.user.id,
      actorRole: permission.role,
      action: "MODIFY",
      targetType: "DOCUMENT",
      targetId: doc._id,
      details:
        doc.title === title
          ? { targetTitle: title }
          : { targetTitle: title, field: "title", oldValue: doc.title, newValue: title },
    });

    revalidateDocs();
    return { success: true, data: { updatedAt: new Date(updated?.updatedAt ?? Date.now()).toISOString() } };
  } catch (error) {
    console.error("[updateDocumentAction]:", error);
    return { success: false, error: "Erro interno ao salvar o documento." };
  }
}

/** Exclui o documento e todos os subdocumentos abaixo dele. */
export async function deleteDocumentAction(input: {
  documentId: string;
}): Promise<ActionResult<{ deleted: number }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "Sessão expirada. Faça login novamente." };

    const parsed = documentIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    await dbConnect();
    const doc = await DocumentModel.findById(parsed.data.documentId)
      .select("workspaceId projectId title")
      .lean<DocLean>();
    if (!doc) return { success: false, error: "Documento não encontrado." };

    const permission = await member(doc.workspaceId.toString(), session.user.id);
    if (!permission.authorized) return { success: false, error: permission.error };

    // coleta a subárvore nível a nível (a árvore de documentos é rasa na prática)
    const ids: Types.ObjectId[] = [doc._id];
    let frontier: Types.ObjectId[] = [doc._id];
    while (frontier.length > 0) {
      const children = await DocumentModel.find({ parentDocId: { $in: frontier } })
        .select("_id")
        .lean<{ _id: Types.ObjectId }[]>();
      frontier = children.map((c) => c._id);
      ids.push(...frontier);
    }

    const result = await DocumentModel.deleteMany({ _id: { $in: ids } });

    await recordHistory({
      workspaceId: doc.workspaceId,
      projectId: doc.projectId ?? null,
      userId: session.user.id,
      actorRole: permission.role,
      action: "DELETE",
      targetType: "DOCUMENT",
      targetId: doc._id,
      details: { targetTitle: doc.title },
    });

    revalidateDocs();
    return { success: true, data: { deleted: result.deletedCount } };
  } catch (error) {
    console.error("[deleteDocumentAction]:", error);
    return { success: false, error: "Erro interno ao excluir o documento." };
  }
}
