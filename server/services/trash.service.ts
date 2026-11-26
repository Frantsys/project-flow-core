import "server-only";
import mongoose, { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { can } from "@/lib/permissions";
import {
  Comment,
  DocumentModel,
  Notification,
  Task,
  TRASH_DAYS,
  TrashItem,
  Workspace,
  type WorkspaceRole,
} from "../db/models";
import type { TrashItemDTO } from "../db/types";

/** Roda numa transação: o item só some do lugar se a cópia entrou na lixeira, e vice-versa. */
async function inTransaction(fn: (session: mongoose.ClientSession) => Promise<void>) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(() => fn(session));
  } finally {
    await session.endSession();
  }
}

/** Tira a tarefa (com os comentários) do projeto e guarda na lixeira. Devolve o id do item. */
export async function trashTask(
  task: { _id: Types.ObjectId; projectId: Types.ObjectId; code: string; title: string },
  workspaceId: Types.ObjectId,
  userId: string
) {
  const [raw, comments] = await Promise.all([
    Task.findById(task._id).lean(),
    Comment.find({ taskId: task._id }).lean(),
  ]);
  let id = "";
  await inTransaction(async (session) => {
    const [item] = await TrashItem.create(
      [
        {
          workspaceId,
          projectId: task.projectId,
          kind: "TASK",
          title: `${task.code} ${task.title}`,
          deletedBy: userId,
          items: [raw],
          comments,
        },
      ],
      { session }
    );
    id = item!._id.toString();
    await Task.deleteOne({ _id: task._id }, { session });
    await Comment.deleteMany({ taskId: task._id }, { session });
  });
  // avisos apontam para a tarefa; não voltam com ela
  await Notification.deleteMany({ taskId: task._id });
  return id;
}

/** Guarda o documento e a subárvore dele (ids[0] é o documento excluído) na lixeira. */
export async function trashDocuments(
  ids: Types.ObjectId[],
  doc: { workspaceId: Types.ObjectId; projectId?: Types.ObjectId | null; title: string },
  userId: string
) {
  const docs = await DocumentModel.find({ _id: { $in: ids } }).lean();
  const order = new Map(ids.map((id, i) => [id.toString(), i]));
  docs.sort((a, b) => order.get(a._id.toString())! - order.get(b._id.toString())!);
  let id = "";
  await inTransaction(async (session) => {
    const [item] = await TrashItem.create(
      [
        {
          workspaceId: doc.workspaceId,
          projectId: doc.projectId ?? null,
          kind: "DOCUMENT",
          title: doc.title,
          deletedBy: userId,
          items: docs,
        },
      ],
      { session }
    );
    id = item!._id.toString();
    await DocumentModel.deleteMany({ _id: { $in: ids } }, { session });
  });
  return { id, deleted: docs.length };
}

/** Quem pode restaurar: documentos, qualquer membro (todos podem excluí-los); tarefas, quem excluiu ou um admin. */
export const canRestore = (role: WorkspaceRole, kind: string, deletedBy: string, userId: string) =>
  kind === "DOCUMENT" || can(role, "task.deleteAny") || deletedBy === userId;

/** Itens da lixeira do workspace, mais recentes primeiro, para quem é membro. */
export async function getTrash(workspaceId: string, userId: string): Promise<TrashItemDTO[] | null> {
  if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(userId)) return null;
  await dbConnect();
  const ws = await Workspace.findOne({ _id: workspaceId, "members.userId": userId })
    .select("members")
    .lean<{ members: { userId: Types.ObjectId; role: WorkspaceRole }[] }>();
  const role = ws?.members.find((m) => m.userId.toString() === userId)?.role;
  if (!role) return null;

  const items = await TrashItem.find({ workspaceId })
    .select("kind title deletedBy createdAt")
    .sort({ createdAt: -1 })
    .limit(200)
    .populate<{ deletedBy: { _id: Types.ObjectId; username: string } | null }>("deletedBy", "username")
    .lean();

  return items.map((item) => {
    const by = item.deletedBy?._id.toString() ?? "";
    return {
      id: item._id.toString(),
      kind: item.kind,
      title: item.title,
      deletedBy: item.deletedBy?.username ?? null,
      deletedAt: item.createdAt.toISOString(),
      expiresAt: new Date(item.createdAt.getTime() + TRASH_DAYS * 86_400_000).toISOString(),
      canRestore: canRestore(role, item.kind, by, userId),
    };
  });
}
