import "server-only";
import { Workspace, WorkspaceRole } from "../db/models";
import dbConnect from "@/lib/db";
import { WorkspaceSummaryDTO } from "../db/types";



export async function getUserWorkspaces(
  userId: string
): Promise<WorkspaceSummaryDTO[]> {
  await dbConnect();

  // faz duas comparações OR, isto é, retorna caso uma seja satisfeita
    const workspaces = await Workspace.find({
        $or: [

            // Se ownerId é o mesmo do usuário, isto é, o usuário é dono do workspace
            { ownerId: userId },

            // Se o usuário é um membro
            { "members.userId": userId }
        ],
    })
    .select("name slug ownerId members createdAt") // Escolhe os campos a serem retornados
    .sort({ createdAt: -1 })
    .lean();


    return workspaces.map((ws) => {
        const memberEntry = ws.members.find(
        (m) => m.userId.toString() === userId
        );

    const role: WorkspaceRole =
      ws.ownerId.toString() === userId
        ? "OWNER"
        : (memberEntry?.role ?? "MEMBER");

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