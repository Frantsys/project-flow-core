"use server"

import { ActionResult } from "@/types";
import { CreateWorkspaceInput, createWorkspaceSchema, DeleteWorkspaceInput, deleteWorkspaceSchema, UpdateWorkspaceInput, updateWorkspaceSchema } from "../schemas";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import { Workspace } from "../db/models";
import { generateWorkspaceSlug } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import z from "zod";
import { deleteWorkspace, updateWorkspace } from "../services/workspace.service";



export async function createWorkspaceAction(
  input: CreateWorkspaceInput
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada. Faça login novamente." };
    }

    const parsed = createWorkspaceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados inválidos.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    }

    await dbConnect();


    const workspace = await Workspace.create({
      name: parsed.data.name,
      slug: generateWorkspaceSlug(parsed.data.name),
      ownerId: session.user.id,
      members: [
        {
          userId: session.user.id, // Como definido, o primeiro WorkspaceMember vai para o Owner, ao criar um novo Workspace
          role: "OWNER",
          joinedAt: new Date(),
        },
      ],
    });


    revalidatePath("/", "layout");

    return {
      success: true,
      data: {
        id: workspace._id.toString(),
        slug: workspace.slug,
      },
    };
  } catch (error) {
    console.error("[createWorkspaceAction]:", error);
    return {
      success: false,
      error: "Erro interno ao criar o workspace.",
    };
  }
}



export async function updateWorkspaceAction(
  input: UpdateWorkspaceInput
): Promise<ActionResult<{ id: string; name: string; slug: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada. Faça login novamente." };
    }

    const parsed = updateWorkspaceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados inválidos.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    }

    const result = await updateWorkspace(session.user.id, parsed.data);

    if (!result.success) {
      return result;
    }

    revalidatePath("/", "layout");
    revalidatePath(`/${result.data.slug}`);

    return result;
  } catch (error) {
    console.error("[updateWorkspaceAction]:", error);
    return {
      success: false,
      error: "Erro interno ao atualizar o workspace.",
    };
  }
}


export async function deleteWorkspaceAction(
    input: DeleteWorkspaceInput
): Promise<ActionResult<{ id: string, name: string }>> {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return { success: false, error: "Sessão expirada, faça login novamente." }
        }

        const parsed = deleteWorkspaceSchema.safeParse(input);
        if (!parsed.success) return {
            success: false,
            error: "ID inválido.",
            fieldErrors: z.flattenError(parsed.error).fieldErrors
        }

        const result = await deleteWorkspace(session.user.id, parsed.data.workspaceId);
        if (!result.success) return result;

        revalidatePath("/", "layout");


        return result;
    } catch (error) {
        console.error("[deleteWorkspaceAction]:", error);

        return {
            success: false,
            error: "Erro interno ao atualizar o workspace.",
        };
    }
}

