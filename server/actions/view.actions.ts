"use server";

import { revalidatePath } from "next/cache";
import dbConnect from "@/lib/db";
import { viewQuery } from "@/lib/saved-views";
import { Project, SavedView } from "../db/models";
import { createAction, fail } from "../lib/action";
import { requirePermission } from "../lib/access";
import { saveViewSchema, viewIdSchema } from "../schemas";

const MAX_VIEWS = 20;

const revalidateProject = () => revalidatePath("/w/[workspaceSlug]/projects/[projectKey]", "layout");

/** Guarda os filtros atuais com um nome. A visão é de quem salvou; só membros do projeto salvam. */
export const saveViewAction = createAction({
  name: "view.save",
  schema: saveViewSchema,
  handler: async ({ projectId, name, query }, { userId }) => {
    await dbConnect();
    const project = await Project.findById(projectId).select("workspaceId").lean();
    if (!project) fail("Projeto não encontrado.");
    await requirePermission(project.workspaceId.toString(), userId, "task.edit");

    // só os parâmetros conhecidos, sempre na mesma ordem
    const params = new URLSearchParams(query);
    const clean = viewQuery((k) => params.get(k));
    if (!clean) fail("Escolha algum filtro antes de salvar a visão.");
    if ((await SavedView.countDocuments({ userId, projectId })) >= MAX_VIEWS) {
      fail(`Use no máximo ${MAX_VIEWS} visões por projeto.`);
    }
    const view = await SavedView.create({ userId, projectId, name, query: clean });
    revalidateProject();
    return { id: view._id.toString(), name: view.name, query: view.query };
  },
});

/** Exclui uma visão da própria pessoa. */
export const deleteViewAction = createAction({
  name: "view.delete",
  schema: viewIdSchema,
  handler: async ({ viewId }, { userId }) => {
    await dbConnect();
    const result = await SavedView.deleteOne({ _id: viewId, userId });
    if (result.deletedCount === 0) fail("Visão não encontrada.");
    revalidateProject();
    return { id: viewId };
  },
});
