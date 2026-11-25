import "server-only";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { ChangeHistory, HistoryAction, HistoryTargetType, Workspace, WorkspaceRole } from "../db/models";
import { HistoryEntryDTO } from "../db/types";

interface RecordHistoryInput {
  workspaceId: Types.ObjectId | string;
  projectId?: Types.ObjectId | string | null;
  userId: string;
  actorRole: WorkspaceRole;
  action: HistoryAction;
  targetType: HistoryTargetType;
  targetId: Types.ObjectId | string;
  parentId?: Types.ObjectId | string | null;
  details: HistoryEntryDTO["details"];
}

/** Grava uma entrada no histórico do workspace. Falha no histórico não desfaz a ação principal. */
export async function recordHistory(input: RecordHistoryInput) {
  try {
    await ChangeHistory.create({ ...input, projectId: input.projectId ?? null, parentId: input.parentId ?? null });
  } catch (error) {
    console.error("[recordHistory]:", error);
  }
}

interface HistoryLean {
  _id: Types.ObjectId;
  action: HistoryAction;
  targetType: HistoryTargetType;
  actorRole: WorkspaceRole;
  userId: { _id: Types.ObjectId; username: string; image?: string | null } | null;
  details?: HistoryEntryDTO["details"];
  createdAt: Date;
}

export function toHistoryDTO(entry: HistoryLean): HistoryEntryDTO {
  return {
    id: entry._id.toString(),
    action: entry.action,
    targetType: entry.targetType,
    actorRole: entry.actorRole,
    user: entry.userId
      ? { id: entry.userId._id.toString(), name: entry.userId.username, image: entry.userId.image ?? null }
      : null,
    details: entry.details ?? {},
    createdAt: new Date(entry.createdAt).toISOString(),
  };
}

export async function findHistory(filter: Record<string, unknown>, limit: number) {
  await dbConnect();
  const entries = await ChangeHistory.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "username image")
    .lean<HistoryLean[]>();
  return entries.map(toHistoryDTO);
}

/** Últimas alterações de um workspace, só para quem é membro. */
export async function getWorkspaceHistory(
  workspaceSlug: string,
  userId: string,
  limit = 50
): Promise<HistoryEntryDTO[] | null> {
  if (!Types.ObjectId.isValid(userId)) return null;
  await dbConnect();

  const workspace = await Workspace.findOne({ slug: workspaceSlug.trim().toLowerCase(), "members.userId": userId })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();
  if (!workspace) return null;

  return findHistory({ workspaceId: workspace._id }, limit);
}
