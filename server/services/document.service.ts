import "server-only";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { DocumentModel, Workspace } from "../db/models";
import { DocumentDTO, DocumentSummaryDTO } from "../db/types";

interface DocLean {
  _id: Types.ObjectId;
  title: string;
  content?: string;
  parentDocId?: Types.ObjectId | null;
  projectId?: Types.ObjectId | null;
  authorId?: { _id: Types.ObjectId; username: string; image?: string | null } | null;
  updatedAt: Date;
}

const summary = (d: DocLean): DocumentSummaryDTO => ({
  id: d._id.toString(),
  title: d.title,
  parentId: d.parentDocId?.toString() ?? null,
  projectId: d.projectId?.toString() ?? null,
  updatedAt: new Date(d.updatedAt).toISOString(),
});

async function workspaceIdFor(slug: string, userId: string) {
  if (!Types.ObjectId.isValid(userId)) return null;
  await dbConnect();
  const ws = await Workspace.findOne({ slug: slug.trim().toLowerCase(), "members.userId": userId })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();
  return ws?._id ?? null;
}

/** Todos os documentos do workspace (sem conteúdo), para montar a árvore. */
export async function getWorkspaceDocuments(slug: string, userId: string): Promise<DocumentSummaryDTO[] | null> {
  const workspaceId = await workspaceIdFor(slug, userId);
  if (!workspaceId) return null;

  const docs = await DocumentModel.find({ workspaceId })
    .select("title parentDocId projectId updatedAt")
    .sort({ title: 1 })
    .lean<DocLean[]>();
  return docs.map(summary);
}

export async function getDocument(slug: string, documentId: string, userId: string): Promise<DocumentDTO | null> {
  if (!Types.ObjectId.isValid(documentId)) return null;
  const workspaceId = await workspaceIdFor(slug, userId);
  if (!workspaceId) return null;

  const doc = await DocumentModel.findOne({ _id: documentId, workspaceId })
    .populate("authorId", "username image")
    .lean<DocLean>();
  if (!doc) return null;

  return {
    ...summary(doc),
    content: doc.content ?? "",
    author: doc.authorId
      ? { id: doc.authorId._id.toString(), name: doc.authorId.username, image: doc.authorId.image ?? null }
      : null,
  };
}
