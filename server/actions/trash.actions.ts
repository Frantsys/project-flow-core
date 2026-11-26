"use server";

import { revalidatePath } from "next/cache";
import mongoose, { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { Comment, DocumentModel, Project, Sprint, Task, TrashItem, Workspace } from "../db/models";
import { createAction, fail } from "../lib/action";
import { requirePermission } from "../lib/access";
import { rankAtEnd } from "../lib/rank";
import { recordHistory } from "../services/history.service";
import { canRestore } from "../services/trash.service";
import { trashItemIdSchema } from "../schemas";

type Raw = Record<string, unknown> & { _id: Types.ObjectId };

/**
 * Devolve o item da lixeira ao lugar. O que mudou enquanto ele estava lá é ajustado em vez de
 * impedir a volta: sprint excluída ou responsável que saiu ficam vazios, coluna removida vira a
 * primeira do quadro, documento-pai excluído faz o documento voltar para a raiz.
 */
export const restoreTrashItemAction = createAction({
  name: "trash.restore",
  schema: trashItemIdSchema,
  handler: async ({ trashId }, { userId }) => {
    await dbConnect();
    const item = await TrashItem.findById(trashId).lean();
    if (!item) fail("Este item não está mais na lixeira.");

    const role = await requirePermission(item.workspaceId.toString(), userId, "task.edit");
    if (!canRestore(role, item.kind, item.deletedBy.toString(), userId)) {
      fail("Só quem excluiu a tarefa, um admin ou o dono pode restaurá-la.");
    }

    const items = item.items as Raw[];
    const comments = item.comments as Raw[];
    const root = items[0];
    if (!root) fail("Este item da lixeira está vazio.");

    if (item.kind === "TASK") {
      const project = await Project.findById(item.projectId)
        .select("statuses")
        .lean<{ _id: Types.ObjectId; statuses: { _id: Types.ObjectId; category: string }[] }>();
      if (!project) fail("O projeto desta tarefa foi excluído.");
      const statusOk = project.statuses.some((s) => s._id.equals(root.statusId as Types.ObjectId));
      if (!statusOk) root.statusId = project.statuses[0]!._id;
      if (root.sprintId && !(await Sprint.exists({ _id: root.sprintId, projectId: project._id }))) {
        root.sprintId = null;
      }
      if (
        root.assigneeId &&
        !(await Workspace.exists({ _id: item.workspaceId, "members.userId": root.assigneeId }))
      ) {
        root.assigneeId = null;
      }
      root.rank = await rankAtEnd(project._id, root.statusId as Types.ObjectId);
    } else {
      const parentGone = root.parentDocId && !(await DocumentModel.exists({ _id: root.parentDocId }));
      if (parentGone) root.parentDocId = null;
      if (root.projectId && !(await Project.exists({ _id: root.projectId }))) {
        for (const doc of items) doc.projectId = null;
      }
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // pela collection, sem o Mongoose: os documentos voltam como eram, com _id e datas originais
        const target = item.kind === "TASK" ? Task : DocumentModel;
        await target.collection.insertMany(items, { session });
        if (comments.length > 0) await Comment.collection.insertMany(comments, { session });
        await TrashItem.deleteOne({ _id: item._id }, { session });
      });
    } finally {
      await session.endSession();
    }

    await recordHistory({
      workspaceId: item.workspaceId,
      projectId: item.projectId,
      userId,
      actorRole: role,
      action: "MODIFY",
      targetType: item.kind,
      targetId: root._id,
      details: { targetTitle: item.title, field: "restored" },
    });

    revalidatePath("/w/[workspaceSlug]", "layout");
    return { kind: item.kind, id: root._id.toString() };
  },
});
