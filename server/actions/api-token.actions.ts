"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import dbConnect from "@/lib/db";
import { ApiToken } from "../db/models";
import { createAction, fail } from "../lib/action";
import { requirePermission } from "../lib/access";
import { newApiToken } from "../lib/api-auth";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID inválido.");

/** Cria um token de leitura da API para o workspace. O valor só aparece nesta resposta. */
export const createApiTokenAction = createAction({
  name: "apiToken.create",
  schema: z.object({
    workspaceId: objectId,
    name: z.string().trim().min(2, "Dê um nome ao token.").max(60, "Use no máximo 60 caracteres."),
  }),
  handler: async ({ workspaceId, name }, { userId }) => {
    await requirePermission(workspaceId, userId, "workspace.update");
    await dbConnect();
    if ((await ApiToken.countDocuments({ workspaceId })) >= 10)
      fail("Este workspace já tem 10 tokens. Revogue um antes.");
    const { token, tokenHash, prefix } = newApiToken();
    await ApiToken.create({ workspaceId, name, tokenHash, prefix, createdBy: userId });
    revalidatePath("/w/[workspaceSlug]/settings", "page");
    return { token };
  },
});

export const revokeApiTokenAction = createAction({
  name: "apiToken.revoke",
  schema: z.object({ workspaceId: objectId, tokenId: objectId }),
  handler: async ({ workspaceId, tokenId }, { userId }) => {
    await requirePermission(workspaceId, userId, "workspace.update");
    await dbConnect();
    const result = await ApiToken.deleteOne({ _id: tokenId, workspaceId });
    if (result.deletedCount === 0) fail("Token não encontrado.");
    revalidatePath("/w/[workspaceSlug]/settings", "page");
    return { id: tokenId };
  },
});
