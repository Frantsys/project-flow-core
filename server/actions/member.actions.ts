"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { randomBytes } from "node:crypto";
import { appUrl, sendEmail } from "@/lib/email";
import { Invitation, User, Workspace, WorkspaceRole } from "../db/models";
import { hashToken } from "../lib/auth-tokens";
import { enforceRateLimit } from "../lib/rate-limit";
import { createAction, fail } from "../lib/action";
import { canChangeRole, canRemoveMember } from "@/lib/permissions";
import { requirePermission } from "../lib/access";
import {
  acceptInvitationSchema,
  invitationRefSchema,
  inviteMemberSchema,
  memberRefSchema,
  updateMemberRoleSchema,
} from "../schemas";

interface WorkspaceMembersLean {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  members: { userId: Types.ObjectId; role: WorkspaceRole }[];
}

function revalidateWorkspace() {
  revalidatePath("/w/[workspaceSlug]", "layout");
  revalidatePath("/workspaces");
}

/** Membro alvo da ação; o dono nunca pode ser alterado nem removido. */
async function loadTargetMember(workspaceId: string, userId: string) {
  await dbConnect();
  const workspace = await Workspace.findById(workspaceId)
    .select("ownerId members")
    .lean<WorkspaceMembersLean>();
  const target = workspace?.members.find((m) => m.userId.toString() === userId);
  if (!workspace || !target) fail("Membro não encontrado.");
  const isOwner = target.role === "OWNER" || workspace.ownerId.toString() === userId;
  return { target, isOwner };
}

const INVITE_TTL = 7 * 24 * 3_600_000;

/**
 * Convida alguém por e-mail, tenha conta ou não. Convidar de novo o mesmo e-mail troca o link
 * (o anterior para de funcionar) e renova a validade de 7 dias.
 */
export const inviteMemberAction = createAction({
  name: "member.invite",
  schema: inviteMemberSchema,
  handler: async ({ workspaceId, email, role }, { userId }) => {
    await requirePermission(workspaceId, userId, "member.manage");
    await enforceRateLimit(`invite:${userId}`, 30, 3_600_000);
    await dbConnect();

    const [workspace, inviter, existing] = await Promise.all([
      Workspace.findById(workspaceId).select("name members.userId").lean(),
      User.findById(userId).select("username").lean(),
      User.findOne({ email }).select("_id").lean(),
    ]);
    if (!workspace) fail("Workspace não encontrado.");
    if (existing && workspace.members.some((m) => m.userId.equals(existing._id))) {
      fail("Essa pessoa já é membro do workspace.", { email: ["Essa pessoa já é membro."] });
    }

    const token = randomBytes(32).toString("base64url");
    await Invitation.updateOne(
      { workspaceId, email },
      {
        $set: {
          role,
          tokenHash: hashToken(token),
          invitedBy: userId,
          expiresAt: new Date(Date.now() + INVITE_TTL),
        },
      },
      { upsert: true }
    );

    try {
      await sendEmail({
        to: email,
        subject: `Convite para o workspace ${workspace.name}`,
        intro: `${inviter?.username ?? "Alguém"} convidou você para o workspace “${workspace.name}” no Project Flow.`,
        action: { label: "Aceitar convite", url: `${appUrl()}/invite?token=${token}` },
        footnote: "O convite vale por 7 dias. Se você não esperava este e-mail, pode ignorá-lo.",
      });
    } catch (error) {
      console.error("[email:invite]", error);
      fail("O convite foi salvo, mas o e-mail não pôde ser enviado. Tente reenviar em instantes.");
    }

    revalidateWorkspace();
    return { email };
  },
});

export const revokeInvitationAction = createAction({
  name: "member.revokeInvitation",
  schema: invitationRefSchema,
  handler: async ({ workspaceId, invitationId }, { userId }) => {
    await requirePermission(workspaceId, userId, "member.manage");
    const result = await Invitation.deleteOne({ _id: invitationId, workspaceId });
    if (result.deletedCount === 0) fail("Convite não encontrado.");
    revalidateWorkspace();
    return { id: invitationId };
  },
});

/**
 * Aceita o convite com a conta logada. O e-mail da conta precisa ser o convidado: um link
 * repassado não serve para outra pessoa entrar no workspace.
 */
export const acceptInvitationAction = createAction({
  name: "member.acceptInvitation",
  schema: acceptInvitationSchema,
  handler: async ({ token }, { userId }) => {
    await dbConnect();
    const invitation = await Invitation.findOne({
      tokenHash: hashToken(token),
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!invitation) fail("Este convite expirou ou já foi usado. Peça um novo a quem convidou.");

    const user = await User.findById(userId).select("email").lean();
    if (user?.email !== invitation.email) {
      fail(`Este convite é para ${invitation.email}. Entre com essa conta para aceitar.`);
    }

    const userObjectId = new Types.ObjectId(userId);
    await Workspace.updateOne(
      { _id: invitation.workspaceId, "members.userId": { $ne: userObjectId } },
      { $push: { members: { userId: userObjectId, role: invitation.role, joinedAt: new Date() } } }
    );
    await Invitation.deleteOne({ _id: invitation._id });

    // o link chegou no e-mail da pessoa: isso também confirma o e-mail
    await User.updateOne({ _id: userId, emailVerified: null }, { $set: { emailVerified: new Date() } });

    const workspace = await Workspace.findById(invitation.workspaceId).select("slug").lean();
    revalidateWorkspace();
    return { slug: workspace?.slug ?? null };
  },
});

/** O dono passa a posse para outro membro e vira admin. Só o dono pode fazer isso. */
export const transferOwnershipAction = createAction({
  name: "member.transferOwnership",
  schema: memberRefSchema,
  handler: async ({ workspaceId, userId: targetId }, { userId }) => {
    await requirePermission(workspaceId, userId, "workspace.transfer");
    if (targetId === userId) fail("Você já é o dono deste workspace.");

    const owner = new Types.ObjectId(userId);
    const target = new Types.ObjectId(targetId);
    // uma única escrita, condicionada a quem é dono agora: duas transferências simultâneas não se cruzam
    const result = await Workspace.updateOne(
      { _id: workspaceId, ownerId: owner, "members.userId": target },
      { $set: { ownerId: target, "members.$[novo].role": "OWNER", "members.$[antigo].role": "ADMIN" } },
      { arrayFilters: [{ "novo.userId": target }, { "antigo.userId": owner }] }
    );
    if (result.modifiedCount === 0) fail("Essa pessoa não é membro do workspace.");

    revalidateWorkspace();
    return { ownerId: targetId };
  },
});

/** Troca o papel entre Admin e Membro. O dono não muda; admin não mexe em outro admin nem em si. */
export const updateMemberRoleAction = createAction({
  name: "member.updateRole",
  schema: updateMemberRoleSchema,
  handler: async ({ workspaceId, userId: targetId, role }, { userId }) => {
    const actorRole = await requirePermission(workspaceId, userId, "member.manage");
    const { target, isOwner } = await loadTargetMember(workspaceId, targetId);

    if (isOwner) fail("O papel do dono não pode ser alterado.");
    if (!canChangeRole(actorRole, target.role, targetId === userId)) {
      fail("Só o dono pode alterar o papel de um admin.");
    }

    await Workspace.updateOne(
      { _id: workspaceId, "members.userId": target.userId },
      { $set: { "members.$.role": role } }
    );

    revalidateWorkspace();
    return { role };
  },
});

/**
 * Remove alguém do workspace. Dono e admins removem outros membros (admin não remove admin);
 * qualquer membro pode sair. O dono não pode ser removido nem sair.
 */
export const removeMemberAction = createAction({
  name: "member.remove",
  schema: memberRefSchema,
  handler: async ({ workspaceId, userId: targetId }, { userId }) => {
    const isSelf = targetId === userId;
    const actorRole = await requirePermission(
      workspaceId,
      userId,
      isSelf ? "workspace.view" : "member.manage"
    );
    const { target, isOwner } = await loadTargetMember(workspaceId, targetId);

    if (isOwner) fail("O dono não pode ser removido do workspace.");
    if (!canRemoveMember(actorRole, target.role, isSelf)) fail("Só o dono pode remover um admin.");

    await Workspace.updateOne({ _id: workspaceId }, { $pull: { members: { userId: target.userId } } });

    revalidateWorkspace();
    return { userId: targetId };
  },
});
