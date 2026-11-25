import "server-only";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { Invitation, Workspace } from "../db/models";
import { hashToken } from "../lib/auth-tokens";

export interface PendingInvitationDTO {
  id: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  invitedBy: string | null;
  expiresAt: string;
}

/** Convites ainda válidos do workspace, mais recentes primeiro. */
export async function getPendingInvitations(workspaceId: string): Promise<PendingInvitationDTO[]> {
  if (!Types.ObjectId.isValid(workspaceId)) return [];
  await dbConnect();
  const invitations = await Invitation.find({ workspaceId, expiresAt: { $gt: new Date() } })
    .populate<{ invitedBy: { username: string } | null }>("invitedBy", "username")
    .sort({ createdAt: -1 })
    .lean();
  return invitations.map((i) => ({
    id: i._id.toString(),
    email: i.email,
    role: i.role,
    invitedBy: i.invitedBy?.username ?? null,
    expiresAt: i.expiresAt.toISOString(),
  }));
}

export interface InvitationPreviewDTO {
  workspaceName: string;
  email: string;
  role: "ADMIN" | "MEMBER";
}

/** O que a página /invite mostra antes de aceitar. null = convite inválido ou vencido. */
export async function getInvitationPreview(token: string): Promise<InvitationPreviewDTO | null> {
  if (!token) return null;
  await dbConnect();
  const invitation = await Invitation.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!invitation) return null;
  const workspace = await Workspace.findById(invitation.workspaceId).select("name").lean();
  if (!workspace) return null;
  return { workspaceName: workspace.name, email: invitation.email, role: invitation.role };
}
