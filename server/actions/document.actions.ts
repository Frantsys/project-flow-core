"use server";

import { revalidatePath } from "next/cache";
import mongoose, { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { DocumentModel, Project } from "../db/models";
import { createAction, fail } from "../lib/action";
import { requirePermission } from "../lib/access";
import { recordHistory } from "../services/history.service";
import { createDocumentSchema, documentIdSchema, updateDocumentSchema } from "../schemas";

interface DocLean {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  projectId?: Types.ObjectId | null;
  title: string;
}

function revalidateDocs() {
  revalidatePath("/w/[workspaceSlug]/docs", "layout");
}

/** Documento existente + papel do usuário. Qualquer membro pode criar, editar e excluir documentos. */
async function loadDocument(documentId: string, userId: string) {
  await dbConnect();
  const doc = await DocumentModel.findById(documentId).select("workspaceId projectId title").lean<DocLean>();
  if (!doc) fail("Documento não encontrado.");
  const role = await requirePermission(doc.workspaceId.toString(), userId, "document.edit");
  return { doc, role };
}

export const createDocumentAction = createAction({
  name: "document.create",
  schema: createDocumentSchema,
  handler: async ({ workspaceId, parentId, title, projectId: requestedProjectId }, { userId }) => {
    const role = await requirePermission(workspaceId, userId, "document.edit");
    await dbConnect();

    let projectId = requestedProjectId ?? null;
    if (parentId) {
      const parent = await DocumentModel.findOne({ _id: parentId, workspaceId })
        .select("projectId")
        .lean<DocLean>();
      if (!parent) fail("Documento pai não encontrado.");
      projectId = parent.projectId?.toString() ?? null; // subdocumento fica no mesmo projeto do pai
    }
    if (projectId && !(await Project.exists({ _id: projectId, workspaceId }))) {
      fail("Projeto não encontrado neste workspace.");
    }

    const doc = await DocumentModel.create({
      workspaceId,
      projectId,
      parentDocId: parentId ?? null,
      authorId: userId,
      title: title || "Sem título",
      content: "",
    });

    await recordHistory({
      workspaceId,
      projectId,
      userId,
      actorRole: role,
      action: "CREATE",
      targetType: "DOCUMENT",
      targetId: doc._id,
      details: { targetTitle: doc.title },
    });

    revalidateDocs();
    return { id: doc._id.toString() };
  },
});

export const updateDocumentAction = createAction({
  name: "document.update",
  schema: updateDocumentSchema,
  handler: async ({ documentId, title, content }, { userId }) => {
    const { doc, role } = await loadDocument(documentId, userId);

    const updated = await DocumentModel.findByIdAndUpdate(
      documentId,
      { $set: { title, content } },
      { returnDocument: "after", runValidators: true }
    )
      .select("updatedAt")
      .lean<{ updatedAt: Date }>();

    await recordHistory({
      workspaceId: doc.workspaceId,
      projectId: doc.projectId ?? null,
      userId,
      actorRole: role,
      action: "MODIFY",
      targetType: "DOCUMENT",
      targetId: doc._id,
      details:
        doc.title === title
          ? { targetTitle: title }
          : { targetTitle: title, field: "title", oldValue: doc.title, newValue: title },
    });

    revalidateDocs();
    return { updatedAt: new Date(updated?.updatedAt ?? Date.now()).toISOString() };
  },
});

/** Exclui o documento e todos os subdocumentos abaixo dele, numa transação. */
export const deleteDocumentAction = createAction({
  name: "document.delete",
  schema: documentIdSchema,
  handler: async ({ documentId }, { userId }) => {
    const { doc, role } = await loadDocument(documentId, userId);

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

    let deleted = 0;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        deleted = (await DocumentModel.deleteMany({ _id: { $in: ids } }, { session })).deletedCount;
      });
    } finally {
      await session.endSession();
    }

    await recordHistory({
      workspaceId: doc.workspaceId,
      projectId: doc.projectId ?? null,
      userId,
      actorRole: role,
      action: "DELETE",
      targetType: "DOCUMENT",
      targetId: doc._id,
      details: { targetTitle: doc.title },
    });

    revalidateDocs();
    return { deleted };
  },
});
