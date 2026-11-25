"use server";

import { revalidatePath } from "next/cache";
import mongoose, { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { ChangeHistory, DocumentModel, Project, Sprint, Task } from "../db/models";
import { createAction, fail } from "../lib/action";
import { requirePermission } from "../lib/access";
import { recordHistory } from "../services/history.service";
import { createProjectSchema, deleteProjectSchema, updateProjectSchema } from "../schemas";

interface ProjectLean {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  key: string;
  name: string;
  description?: string | null;
}

interface IdOnlyLean {
  _id: Types.ObjectId;
}

const isDuplicateKey = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;

/** Projeto existente + papel do usuário (só dono e admin mexem na estrutura do projeto). */
async function loadProjectForManager(projectId: string, userId: string) {
  await dbConnect();
  const project = await Project.findById(projectId)
    .select("workspaceId key name description")
    .lean<ProjectLean>();
  if (!project) fail("Projeto não encontrado.");

  const role = await requirePermission(project.workspaceId.toString(), userId, "project.manage");
  return { project, role };
}

export const createProjectAction = createAction({
  name: "project.create",
  schema: createProjectSchema,
  handler: async ({ workspaceId, name, key, description }, { userId }) => {
    const role = await requirePermission(workspaceId, userId, "project.manage");
    await dbConnect();

    let project;
    try {
      project = await Project.create({ workspaceId, name, key, ...(description ? { description } : {}) });
    } catch (error) {
      if (isDuplicateKey(error)) {
        fail("Já existe um projeto com essa chave neste workspace.", {
          key: ["Esta chave já está em uso neste workspace."],
        });
      }
      throw error;
    }

    await recordHistory({
      workspaceId,
      projectId: project._id,
      userId,
      actorRole: role,
      action: "CREATE",
      targetType: "PROJECT",
      targetId: project._id,
      details: { targetTitle: `${project.key} · ${project.name}` },
    });

    revalidatePath("/", "layout");
    return { id: project._id.toString(), name: project.name, key: project.key };
  },
});

export const updateProjectAction = createAction({
  name: "project.update",
  schema: updateProjectSchema,
  handler: async ({ projectId, name, description }, { userId }) => {
    const { project, role } = await loadProjectForManager(projectId, userId);

    const set: { name?: string; description?: string | null } = {};
    if (name !== undefined) set.name = name;
    if (description !== undefined) set.description = description || null;

    const updated = await Project.findByIdAndUpdate(
      projectId,
      { $set: set },
      { returnDocument: "after", runValidators: true }
    )
      .select("_id name key description")
      .lean<ProjectLean>();
    if (!updated) fail("Projeto não encontrado.");

    const targetTitle = `${updated.key} · ${updated.name}`;
    await recordHistory({
      workspaceId: project.workspaceId,
      projectId: project._id,
      userId,
      actorRole: role,
      action: "MODIFY",
      targetType: "PROJECT",
      targetId: project._id,
      details:
        name !== undefined && name !== project.name
          ? { targetTitle, field: "name", oldValue: project.name, newValue: updated.name }
          : { targetTitle },
    });

    revalidatePath("/", "layout");
    return {
      id: updated._id.toString(),
      name: updated.name,
      key: updated.key,
      description: updated.description ?? null,
    };
  },
});

/**
 * Exclui o projeto e tudo que pertence a ele (tarefas, sprints, documentos e o histórico deles)
 * numa transação: o Mongo não tem exclusão em cascata.
 */
export const deleteProjectAction = createAction({
  name: "project.delete",
  schema: deleteProjectSchema,
  handler: async ({ projectId }, { userId }) => {
    const { project, role } = await loadProjectForManager(projectId, userId);

    const [tasks, sprints, documents] = await Promise.all([
      Task.find({ projectId }).select("_id").lean<IdOnlyLean[]>(),
      Sprint.find({ projectId }).select("_id").lean<IdOnlyLean[]>(),
      DocumentModel.find({ projectId }).select("_id").lean<IdOnlyLean[]>(),
    ]);
    const relatedIds = [project._id, ...tasks, ...sprints, ...documents].map((d) =>
      d instanceof Types.ObjectId ? d : d._id
    );

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Task.deleteMany({ projectId }, { session });
        await Sprint.deleteMany({ projectId }, { session });
        await DocumentModel.deleteMany({ projectId }, { session });
        await ChangeHistory.deleteMany(
          { $or: [{ parentId: project._id }, { targetId: { $in: relatedIds } }] },
          { session }
        );
        await Project.deleteOne({ _id: projectId }, { session });
      });
    } finally {
      await session.endSession();
    }

    // depois da transação (que apaga o histórico do projeto) e sem projectId: fica no feed do workspace
    await recordHistory({
      workspaceId: project.workspaceId,
      projectId: null,
      userId,
      actorRole: role,
      action: "DELETE",
      targetType: "PROJECT",
      targetId: project._id,
      details: { targetTitle: `${project.key} · ${project.name}` },
    });

    revalidatePath("/", "layout");
    return { id: projectId };
  },
});
