import "server-only";
import {
  ApiToken,
  ChangeHistory,
  Comment,
  DocumentModel,
  Invitation,
  Notification,
  Project,
  Sprint,
  Task,
  Workspace,
  WorkspaceRole,
} from "../db/models";
import dbConnect from "@/lib/db";
import {
  WorkspaceDTO,
  WorkspaceMemberDTO,
  WorkspaceProjectSummaryDTO,
  WorkspaceSummaryDTO,
} from "../db/types";
import mongoose, { Types } from "mongoose";
import { UpdateWorkspaceInput } from "../schemas";
import { ActionResult } from "@/types";
import { verifyWorkspacePermission } from "./permission.service";
import { PERMISSIONS } from "@/lib/permissions";

export async function getUserWorkspaces(userId: string): Promise<WorkspaceSummaryDTO[]> {
  await dbConnect();

  // faz duas comparações OR, isto é, retorna caso uma seja satisfeita
  const workspaces = await Workspace.find({
    $or: [
      // Se ownerId é o mesmo do usuário, isto é, o usuário é dono do workspace
      { ownerId: userId },

      // Se o usuário é um membro
      { "members.userId": userId },
    ],
  })
    .select("name slug ownerId members createdAt") // Escolhe os campos a serem retornados
    .sort({ createdAt: -1 })
    .lean();

  // Serve para pegar o Role do usuário em cada workspace que ele é membro
  return workspaces.map((ws) => {
    const memberEntry = ws.members.find((m) => m.userId.toString() === userId);

    // Valida o cargo do usuário
    const role: WorkspaceRole = ws.ownerId.toString() === userId ? "OWNER" : (memberEntry?.role ?? "MEMBER");

    return {
      id: ws._id.toString(),
      name: ws.name,
      slug: ws.slug,
      role,
      memberCount: ws.members.length,
      createdAt: ws.createdAt.toISOString(),
    };
  });
}

/**
 *  Conjunto de interfaces para o type checking do typescript
 *
 */

interface PopulateUserLean {
  _id: Types.ObjectId;
  username: string;
  email: string;
  image?: string | null;
}

interface PopulateWorkspaceMemberLean {
  userId: PopulateUserLean;
  role: WorkspaceRole;
  joinedAt: Date;
}

interface WorkspacePopulatedLean {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  ownerId: PopulateUserLean | null;
  members: PopulateWorkspaceMemberLean[];
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectSummaryLean {
  _id: string;
  name: string;
  key: string;
}

export async function getWorkspaceBySlug(slug: string, userId: string): Promise<WorkspaceDTO | null> {
  if (!slug || !Types.ObjectId.isValid(userId)) {
    return null;
  }

  await dbConnect();

  const workspace = await Workspace.findOne({ slug: slug.trim().toLowerCase(), "members.userId": userId })
    .populate("ownerId", "username email image")
    .populate("members.userId", "username email image")
    .lean<WorkspacePopulatedLean>();

  if (!workspace || !workspace.ownerId) {
    return null;
  }

  const members: WorkspaceMemberDTO[] = workspace.members
    .filter((m): m is PopulateWorkspaceMemberLean & { userId: PopulateUserLean } => Boolean(m.userId))
    .map((member) => {
      return {
        // o lean devolve ObjectId: sem toString a comparação com o userId (texto) nunca batia
        id: member.userId._id.toString(),
        name: member.userId.username,
        email: member.userId.email,
        image: member.userId.image,
        role: member.role,
        joinedAt: new Date(member.joinedAt).toISOString(),
      };
    });

  const currentMember = members.find((member) => member.id === userId);
  if (!currentMember) {
    return null;
  }

  const workspaceProjects = await Project.find({ workspaceId: workspace?._id })
    .select("_id name key")
    .sort({ createdAt: 1 })
    .lean<ProjectSummaryLean[]>();

  const projects: WorkspaceProjectSummaryDTO[] = workspaceProjects.map((project) => ({
    id: project._id.toString(),
    name: project.name,
    key: project.key,
  }));

  return {
    id: workspace._id.toString(),
    name: workspace.name,
    slug: workspace.slug,
    currentUserRole: currentMember.role,
    owner: {
      id: workspace.ownerId._id.toString(),
      name: workspace.ownerId.username,
      email: workspace.ownerId.email,
      image: workspace.ownerId.image ?? null,
    },
    stats: {
      membersCount: members.length,
      projectsCount: projects.length,
    },
    members,
    projects,
    createdAt: new Date(workspace.createdAt).toISOString(),
    updatedAt: new Date(workspace.updatedAt).toISOString(),
  };
}

export async function updateWorkspace(
  userId: string,
  input: UpdateWorkspaceInput
): Promise<ActionResult<{ id: string; name: string; slug: string }>> {
  const permission = await verifyWorkspacePermission({
    workspaceId: input.workspaceId,
    userId,
    allowedRoles: [...PERMISSIONS["workspace.update"]],
  });

  if (!permission.authorized) {
    return {
      success: false,
      error: permission.error,
    };
  }

  await dbConnect();

  const updated = await Workspace.findByIdAndUpdate(
    input.workspaceId,
    { $set: { name: input.name } },
    { returnDocument: "after", runValidators: true }
  )
    .select("_id name slug")
    .lean<{ _id: Types.ObjectId; name: string; slug: string }>();

  if (!updated) {
    return { success: false, error: "Workspace não encontrado." };
  }

  return {
    success: true,
    data: {
      id: updated._id.toString(),
      name: updated.name,
      slug: updated.slug,
    },
  };
}

export async function deleteWorkspace(
  userId: string,
  workspaceId: string
): Promise<ActionResult<{ id: string; name: string }>> {
  if (!Types.ObjectId.isValid(workspaceId)) {
    return {
      success: false,
      error: "ID de workspace inválido.",
    };
  }

  const permission = await verifyWorkspacePermission({
    workspaceId: workspaceId,
    userId,
    allowedRoles: [...PERMISSIONS["workspace.delete"]],
  });

  if (!permission.authorized) {
    return {
      success: false,
      error: permission.error,
    };
  }

  await dbConnect();

  const workspace = await Workspace.findById(workspaceId)
    .select("_id name")
    .lean<{ _id: Types.ObjectId; name: string }>();
  if (!workspace) return { success: false, error: "Workspace não encontrado." };

  const projectIds = (
    await Project.find({ workspaceId }).select("_id").lean<{ _id: Types.ObjectId }[]>()
  ).map((p) => p._id);

  // O Mongo não tem exclusão em cascata: apaga tudo que pertence ao workspace numa transação,
  // para não sobrar projeto, tarefa ou documento órfão se algo falhar no meio
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Task.deleteMany({ projectId: { $in: projectIds } }, { session });
      await Comment.deleteMany({ workspaceId }, { session });
      await Notification.deleteMany({ workspaceId }, { session });
      await Invitation.deleteMany({ workspaceId }, { session });
      await ApiToken.deleteMany({ workspaceId }, { session });
      await Sprint.deleteMany({ projectId: { $in: projectIds } }, { session });
      await DocumentModel.deleteMany({ workspaceId }, { session });
      await ChangeHistory.deleteMany({ workspaceId }, { session });
      await Project.deleteMany({ workspaceId }, { session });
      await Workspace.deleteOne({ _id: workspaceId }, { session });
    });
  } finally {
    await session.endSession();
  }

  return {
    success: true,
    data: {
      id: workspace._id.toString(),
      name: workspace.name,
    },
  };
}
