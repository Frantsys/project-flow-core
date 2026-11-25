"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import z from "zod";

import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import { ActionResult } from "@/types";
import { User, Workspace, WorkspaceRole } from "../db/models";
import { verifyWorkspacePermission } from "../services/permission.service";
import { addMemberSchema, memberRefSchema, updateMemberRoleSchema } from "../schemas";

interface WorkspaceMembersLean {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  members: { userId: Types.ObjectId; role: WorkspaceRole }[];
}

function invalid(error: z.ZodError) {
  return { success: false as const, error: "Dados inválidos.", fieldErrors: z.flattenError(error).fieldErrors };
}

function revalidateWorkspace() {
  revalidatePath("/w/[workspaceSlug]", "layout");
  revalidatePath("/workspaces");
}

/**
 * Adiciona ao workspace uma pessoa que já tem conta no Project Flow.
 * shortcut: não há envio de convite por e-mail (o projeto não tem serviço de e-mail); a pessoa precisa
 * ter criado a conta antes. Trocar por convites com token quando houver um provedor de e-mail.
 */
export async function addMemberAction(input: {
  workspaceId: string;
  email: string;
  role: "ADMIN" | "MEMBER";
}): Promise<ActionResult<{ userId: string; name: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "Sessão expirada. Faça login novamente." };

    const parsed = addMemberSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { workspaceId, email, role } = parsed.data;

    const permission = await verifyWorkspacePermission({ workspaceId, userId: session.user.id, allowedRoles: ["OWNER", "ADMIN"] });
    if (!permission.authorized) return { success: false, error: permission.error };

    await dbConnect();
    const user = await User.findOne({ email }).select("_id username").lean<{ _id: Types.ObjectId; username: string }>();
    if (!user) {
      return {
        success: false,
        error: "Não há conta com esse e-mail.",
        fieldErrors: { email: ["Não há conta com esse e-mail. Peça para a pessoa criar uma conta primeiro."] },
      };
    }

    // a condição no filtro evita duplicar o membro se duas pessoas adicionarem ao mesmo tempo
    const result = await Workspace.updateOne(
      { _id: workspaceId, "members.userId": { $ne: user._id } },
      { $push: { members: { userId: user._id, role, joinedAt: new Date() } } }
    );
    if (result.modifiedCount === 0) {
      return { success: false, error: "Essa pessoa já é membro do workspace.", fieldErrors: { email: ["Essa pessoa já é membro."] } };
    }

    revalidateWorkspace();
    return { success: true, data: { userId: user._id.toString(), name: user.username } };
  } catch (error) {
    console.error("[addMemberAction]:", error);
    return { success: false, error: "Erro interno ao adicionar o membro." };
  }
}

/** Troca o papel entre Admin e Membro. O dono não pode ser alterado. */
export async function updateMemberRoleAction(input: {
  workspaceId: string;
  userId: string;
  role: "ADMIN" | "MEMBER";
}): Promise<ActionResult<{ role: WorkspaceRole }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "Sessão expirada. Faça login novamente." };

    const parsed = updateMemberRoleSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { workspaceId, userId, role } = parsed.data;

    const permission = await verifyWorkspacePermission({ workspaceId, userId: session.user.id, allowedRoles: ["OWNER", "ADMIN"] });
    if (!permission.authorized) return { success: false, error: permission.error };

    await dbConnect();
    const workspace = await Workspace.findById(workspaceId).select("ownerId members").lean<WorkspaceMembersLean>();
    const target = workspace?.members.find((m) => m.userId.toString() === userId);
    if (!workspace || !target) return { success: false, error: "Membro não encontrado." };
    if (target.role === "OWNER" || workspace.ownerId.toString() === userId) {
      return { success: false, error: "O papel do dono não pode ser alterado." };
    }
    if (permission.role === "ADMIN" && (target.role === "ADMIN" || userId === session.user.id)) {
      return { success: false, error: "Só o dono pode alterar o papel de um admin." };
    }

    await Workspace.updateOne({ _id: workspaceId, "members.userId": target.userId }, { $set: { "members.$.role": role } });

    revalidateWorkspace();
    return { success: true, data: { role } };
  } catch (error) {
    console.error("[updateMemberRoleAction]:", error);
    return { success: false, error: "Erro interno ao alterar o papel." };
  }
}

/**
 * Remove alguém do workspace. Dono e admins removem outros membros; qualquer membro pode sair
 * (remover a si mesmo). O dono não pode ser removido nem sair.
 */
export async function removeMemberAction(input: { workspaceId: string; userId: string }): Promise<ActionResult<{ userId: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "Sessão expirada. Faça login novamente." };

    const parsed = memberRefSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { workspaceId, userId } = parsed.data;

    const isSelf = userId === session.user.id;
    const permission = await verifyWorkspacePermission({
      workspaceId,
      userId: session.user.id,
      allowedRoles: isSelf ? ["OWNER", "ADMIN", "MEMBER"] : ["OWNER", "ADMIN"],
    });
    if (!permission.authorized) return { success: false, error: permission.error };

    await dbConnect();
    const workspace = await Workspace.findById(workspaceId).select("ownerId members").lean<WorkspaceMembersLean>();
    const target = workspace?.members.find((m) => m.userId.toString() === userId);
    if (!workspace || !target) return { success: false, error: "Membro não encontrado." };
    if (target.role === "OWNER" || workspace.ownerId.toString() === userId) {
      return { success: false, error: "O dono não pode ser removido do workspace." };
    }
    if (!isSelf && permission.role === "ADMIN" && target.role === "ADMIN") {
      return { success: false, error: "Só o dono pode remover um admin." };
    }

    await Workspace.updateOne({ _id: workspaceId }, { $pull: { members: { userId: target.userId } } });

    revalidateWorkspace();
    return { success: true, data: { userId } };
  } catch (error) {
    console.error("[removeMemberAction]:", error);
    return { success: false, error: "Erro interno ao remover o membro." };
  }
}
