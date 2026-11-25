import dbConnect from "@/lib/db";
import { Types } from "mongoose";
import { ChangeHistory, Workspace } from "../db/models";
import { ChangeTargetType, ChangeActionType, ChangeHistoryDTO } from "../db/types";

// interface de input
interface RecordChangeParams {
    workspaceId: string | Types.ObjectId;
    targetType: ChangeTargetType;
    targetId: string | Types.ObjectId;
    parentId?: string | Types.ObjectId | null;
    actorId: string | Types.ObjectId;
    action: ChangeActionType;
    summary: string
    details?: Record<string, unknown> | null;
}


// output de lean
interface PopulatedHistoryLean {
    _id: Types.ObjectId;
    workspaceId: Types.ObjectId;
    targetType: ChangeTargetType;
    targetId: Types.ObjectId;
    parentId?: Types.ObjectId | null;
    action: ChangeActionType;
    summary: string
    details?: Record<string, unknown> | null;
    actorId: {
        _id: Types.ObjectId;
        name: string;
        image?: string | null;
    } | null;
    createdAt: Date;
}


// mapeamento necessário para a normalização dos dados com fallback para campos nulos
function mapHistoryToDTO(doc: PopulatedHistoryLean): ChangeHistoryDTO {
  return {
    id: doc._id.toString(),
    workspaceId: doc.workspaceId.toString(),
    targetType: doc.targetType,
    targetId: doc.targetId.toString(),
    parentId: doc.parentId ? doc.parentId.toString() : null,
    action: doc.action,
    details: doc.details,
    summary: doc.summary,
    actor: doc.actorId
      ? {
          id: doc.actorId._id.toString(),
          name: doc.actorId.name,
          image: doc.actorId.image ?? null,
        }
      : {
          id: "",
          name: "Sistema",
          image: null,
        },
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

/**
 * Grava um registro polimórfico de auditoria e dispara o evento em tempo real
 * para todos os membros conectados daquele workspace via SSE.
 */
export async function recordChangeHistory(
  params: RecordChangeParams
): Promise<ChangeHistoryDTO | null> {
  try {
    await dbConnect();

    const created = await ChangeHistory.create({
      workspaceId: params.workspaceId,
      targetType: params.targetType,
      targetId: params.targetId,
      parentId: params.parentId ?? null,
      actorId: params.actorId,
      action: params.action,

    });

    const populated = await ChangeHistory.findById(created._id)
      .populate("actorId", "name image")
      .lean<PopulatedHistoryLean>();

    if (!populated) return null;

    const dto = mapHistoryToDTO(populated);

    return dto;
  } catch (error) {
    // Falha de auditoria não deve derrubar a mutação principal já concluída
    console.error("[recordChangeHistory]:", error);
    return null;
  }

}

/**
 * Lista o histórico polimórfico de uma entidade específica (ex: Task ou Project),
 * incluindo eventos filhos vinculados via parentId.
 */
export async function getEntityHistory(
  workspaceId: string,
  targetId: string,
  userId: string,
  limit = 30
): Promise<ChangeHistoryDTO[] | null> {
  if (
    !Types.ObjectId.isValid(workspaceId) ||
    !Types.ObjectId.isValid(targetId) ||
    !Types.ObjectId.isValid(userId)
  ) {
    return null;
  }

  await dbConnect();

  const isMember = await Workspace.exists({
    _id: workspaceId,
    "members.userId": userId,
  });

  if (!isMember) return null;

  const targetObjectId = new Types.ObjectId(targetId);

  const logs = await ChangeHistory.find({
    workspaceId,
    $or: [{ targetId: targetObjectId }, { parentId: targetObjectId }],
  })
    .populate("actorId", "name image")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<PopulatedHistoryLean[]>();

  return logs.map(mapHistoryToDTO);
}

/**
 * Carrega o feed inicial de notificações globais do usuário (atividades de outros
 * membros em todos os workspaces que ele participa).
 */
export async function getGlobalNotificationsFeed(
  userId: string,
  limit = 25
): Promise<ChangeHistoryDTO[]> {
  if (!Types.ObjectId.isValid(userId)) return [];

  await dbConnect();

  const workspaces = await Workspace.find({ "members.userId": userId })
    .select("_id")
    .lean<{ _id: Types.ObjectId }[]>();

  if (workspaces.length === 0) return [];

  const workspaceIds = workspaces.map((w) => w._id);

  const logs = await ChangeHistory.find({
    workspaceId: { $in: workspaceIds },
    actorId: { $ne: userId },
  })
    .populate("actorId", "name image")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<PopulatedHistoryLean[]>();

  return logs.map(mapHistoryToDTO);
}


export async function getRecentWorkspaceHistory(
  workspaceId: string,
  limit = 10
): Promise<ChangeHistoryDTO[]> {
  if (!Types.ObjectId.isValid(workspaceId)) return [];

  await dbConnect();

  const logs = await ChangeHistory.find({ workspaceId })
    .populate("actorId", "name image")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<PopulatedHistoryLean[]>();

  return logs.map(mapHistoryToDTO);
}