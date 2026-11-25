"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { User, Workspace, WorkspaceRole } from "../db/models";
import { createAction, fail } from "../lib/action";
import { ALL_ROLES, MANAGERS, requireWorkspaceRole } from "../lib/access";
import { addMemberSchema, memberRefSchema, updateMemberRoleSchema } from "../schemas";

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

/**
 * Adiciona ao workspace uma pessoa que já tem conta no Project Flow.
 * shortcut: não há convite por e-mail (falta um provedor de e-mail); a pessoa precisa ter criado
 * a conta antes. Trocar por convites com token quando o envio de e-mail existir (plano, item 3.6).
 */
export const addMemberAction = createAction({
  name: "member.add",
  schema: addMemberSchema,
  handler: async ({ workspaceId, email, role }, { userId }) => {
    await requireWorkspaceRole(workspaceId, userId, MANAGERS);
    await dbConnect();

    const user = await User.findOne({ email })
      .select("_id username")
      .lean<{ _id: Types.ObjectId; username: string }>();
    if (!user) {
      fail("Não há conta com esse e-mail.", {
        email: ["Não há conta com esse e-mail. Peça para a pessoa criar uma conta primeiro."],
      });
    }

    // a condição no filtro evita duplicar o membro se duas pessoas adicionarem ao mesmo tempo
    const result = await Workspace.updateOne(
      { _id: workspaceId, "members.userId": { $ne: user._id } },
      { $push: { members: { userId: user._id, role, joinedAt: new Date() } } }
    );
    if (result.modifiedCount === 0) {
      fail("Essa pessoa já é membro do workspace.", { email: ["Essa pessoa já é membro."] });
    }

    revalidateWorkspace();
    return { userId: user._id.toString(), name: user.username };
  },
});

/** Troca o papel entre Admin e Membro. O dono não muda; admin não mexe em outro admin nem em si. */
export const updateMemberRoleAction = createAction({
  name: "member.updateRole",
  schema: updateMemberRoleSchema,
  handler: async ({ workspaceId, userId: targetId, role }, { userId }) => {
    const actorRole = await requireWorkspaceRole(workspaceId, userId, MANAGERS);
    const { target, isOwner } = await loadTargetMember(workspaceId, targetId);

    if (isOwner) fail("O papel do dono não pode ser alterado.");
    if (actorRole === "ADMIN" && (target.role === "ADMIN" || targetId === userId)) {
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
    const actorRole = await requireWorkspaceRole(workspaceId, userId, isSelf ? ALL_ROLES : MANAGERS);
    const { target, isOwner } = await loadTargetMember(workspaceId, targetId);

    if (isOwner) fail("O dono não pode ser removido do workspace.");
    if (!isSelf && actorRole === "ADMIN" && target.role === "ADMIN") fail("Só o dono pode remover um admin.");

    await Workspace.updateOne({ _id: workspaceId }, { $pull: { members: { userId: target.userId } } });

    revalidateWorkspace();
    return { userId: targetId };
  },
});
