"use server";

import { revalidatePath } from "next/cache";
import dbConnect from "@/lib/db";
import { generateWorkspaceSlug } from "@/lib/utils";
import { Workspace } from "../db/models";
import { createAction, fail } from "../lib/action";
import { createWorkspaceSchema, deleteWorkspaceSchema, updateWorkspaceSchema } from "../schemas";
import { deleteWorkspace, updateWorkspace } from "../services/workspace.service";

export const createWorkspaceAction = createAction({
  name: "workspace.create",
  schema: createWorkspaceSchema,
  handler: async ({ name }, { userId }) => {
    await dbConnect();

    const workspace = await Workspace.create({
      name,
      slug: generateWorkspaceSlug(name),
      ownerId: userId,
      // quem cria o workspace entra como o primeiro membro, com papel de dono
      members: [{ userId, role: "OWNER", joinedAt: new Date() }],
    });

    revalidatePath("/", "layout");
    return { id: workspace._id.toString(), slug: workspace.slug };
  },
});

export const updateWorkspaceAction = createAction({
  name: "workspace.update",
  schema: updateWorkspaceSchema,
  handler: async (input, { userId }) => {
    const result = await updateWorkspace(userId, input);
    if (!result.success) fail(result.error);

    revalidatePath("/", "layout");
    return result.data;
  },
});

export const deleteWorkspaceAction = createAction({
  name: "workspace.delete",
  schema: deleteWorkspaceSchema,
  handler: async ({ workspaceId }, { userId }) => {
    const result = await deleteWorkspace(userId, workspaceId);
    if (!result.success) fail(result.error);

    revalidatePath("/", "layout");
    return result.data;
  },
});
