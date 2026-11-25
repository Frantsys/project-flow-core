import { Types } from "mongoose"
import { Workspace, WorkspaceRole } from "../db/models"
import dbConnect from "@/lib/db"


interface WorkspaceMemberLean {
    _id: string
    members: {
        userId: string
        role: WorkspaceRole
    }[]
}

export type PermissionCheckResult = 
    | { authorized: true, role: WorkspaceRole }
    | { authorized: false, error: string }

interface VerifyWorkspacePermissionParams {
  workspaceId: string;
  userId: string;
  allowedRoles: WorkspaceRole[];
}

export async function verifyWorkspacePermission({
    workspaceId,
    userId,
    allowedRoles
}: VerifyWorkspacePermissionParams): Promise<PermissionCheckResult> {
    if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(userId)) {
        return { authorized: false, error: "Identificador inválido." };
    }

    await dbConnect();

    // Valida de maneira inversa
    // Pega a entidade pai Workspace, encontra o WorkspaceMember a partir dela e só então
    // o cargo é validado

    const workspace = await Workspace.findOne({
        _id: workspaceId,
        "members.userId": userId,
    })
    .select("members.$")
    .lean<WorkspaceMemberLean>();

    const member = workspace?.members?.[0];

    if (!member) {
        return {
            authorized: false,
            error: "Você não tem acesso a este workspace.",
        };
    }

    if (!allowedRoles.includes(member.role)) {
        return {
            authorized: false,
            error: "Você não possui permissão para realizar esta ação.",
        };
    }

    return { authorized: true, role: member.role };
} 



export function canMutateOwnedResource(params: {
  role: WorkspaceRole;
  creatorId: string;
  userId: string;
  privilegedRoles?: WorkspaceRole[];
}): boolean {
    
    // Objeto desestruturado
    // tudo isso para não criar um type novo?
    const {
        role,
        creatorId,
        userId,
        privilegedRoles = ["OWNER", "ADMIN"], // apenas para isso?
    } = params; 

    if (privilegedRoles.includes(role)) {
        return true;
    }  

    return creatorId === userId;
}