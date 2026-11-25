"use server";

import { revalidatePath } from "next/cache";
import mongoose, { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { Project, Sprint, Task } from "../db/models";
import { createAction, fail } from "../lib/action";
import { requirePermission } from "../lib/access";
import { recordHistory } from "../services/history.service";
import { completeSprintSchema, createSprintSchema, sprintIdSchema } from "../schemas";

interface ProjectLean {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  statuses: { _id: Types.ObjectId; category: string }[];
}

interface SprintLean {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  name: string;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
  startDate?: Date | null;
  endDate?: Date | null;
}

function revalidateProjectPages() {
  revalidatePath("/w/[workspaceSlug]/projects/[projectKey]", "layout");
}

const toDate = (d?: string | null) => (d ? new Date(`${d}T00:00:00.000Z`) : null);

/** Planejar, iniciar e concluir sprints é decisão de dono ou admin. */
async function loadProject(projectId: Types.ObjectId | string, userId: string) {
  await dbConnect();
  const project = await Project.findById(projectId).select("workspaceId statuses").lean<ProjectLean>();
  if (!project) fail("Projeto não encontrado.");
  const role = await requirePermission(project.workspaceId.toString(), userId, "sprint.manage");

  const history = (
    action: "CREATE" | "MODIFY" | "DELETE",
    sprint: { _id: Types.ObjectId; name: string },
    change?: { oldValue: string; newValue: string }
  ) =>
    recordHistory({
      workspaceId: project.workspaceId,
      projectId: project._id,
      userId,
      actorRole: role,
      action,
      targetType: "SPRINT",
      targetId: sprint._id,
      details: change
        ? { targetTitle: sprint.name, field: "status", ...change }
        : { targetTitle: sprint.name },
    });

  return { project, history };
}

async function loadSprint(sprintId: string, userId: string) {
  await dbConnect();
  const sprint = await Sprint.findById(sprintId).lean<SprintLean>();
  if (!sprint) fail("Sprint não encontrada.");
  return { sprint, ...(await loadProject(sprint.projectId, userId)) };
}

export const createSprintAction = createAction({
  name: "sprint.create",
  schema: createSprintSchema,
  handler: async ({ projectId, name, goal, startDate, endDate }, { userId }) => {
    const { history } = await loadProject(projectId, userId);

    const sprint = await Sprint.create({
      projectId,
      name,
      goal: goal ?? "",
      startDate: toDate(startDate),
      endDate: toDate(endDate),
      status: "PLANNED",
    });
    await history("CREATE", sprint);

    revalidateProjectPages();
    return { id: sprint._id.toString() };
  },
});

/** Inicia uma sprint planejada. Só uma sprint pode estar ativa por projeto. */
export const startSprintAction = createAction({
  name: "sprint.start",
  schema: sprintIdSchema,
  handler: async ({ sprintId }, { userId }) => {
    const { sprint, history } = await loadSprint(sprintId, userId);
    if (sprint.status !== "PLANNED") fail("Só uma sprint planejada pode ser iniciada.");

    const active = await Sprint.exists({ projectId: sprint.projectId, status: "ACTIVE" });
    if (active) fail("Já existe uma sprint ativa. Conclua ela antes de iniciar outra.");

    await Sprint.updateOne(
      { _id: sprint._id },
      { $set: { status: "ACTIVE", startDate: sprint.startDate ?? new Date() } }
    );
    await history("MODIFY", sprint, { oldValue: "PLANNED", newValue: "ACTIVE" });

    revalidateProjectPages();
    return { id: sprintId };
  },
});

/**
 * Conclui a sprint ativa. Tarefas fora dos status da categoria "Concluído"
 * vão para outra sprint planejada ou de volta ao backlog, na mesma transação que fecha a sprint.
 */
export const completeSprintAction = createAction({
  name: "sprint.complete",
  schema: completeSprintSchema,
  handler: async ({ sprintId, moveToSprintId }, { userId }) => {
    const { sprint, project, history } = await loadSprint(sprintId, userId);
    if (sprint.status !== "ACTIVE") fail("Só a sprint ativa pode ser concluída.");

    if (moveToSprintId) {
      const target = await Sprint.exists({
        _id: moveToSprintId,
        projectId: sprint.projectId,
        status: "PLANNED",
      });
      if (!target) fail("Escolha uma sprint planejada deste projeto.");
    }

    const doneIds = project.statuses.filter((s) => s.category === "DONE").map((s) => s._id);
    let moved = 0;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const result = await Task.updateMany(
          { sprintId: sprint._id, statusId: { $nin: doneIds } },
          { $set: { sprintId: moveToSprintId ?? null } },
          { session }
        );
        moved = result.modifiedCount;
        await Sprint.updateOne(
          { _id: sprint._id },
          { $set: { status: "COMPLETED", endDate: sprint.endDate ?? new Date() } },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    await history("MODIFY", sprint, { oldValue: "ACTIVE", newValue: "COMPLETED" });

    revalidateProjectPages();
    return { moved };
  },
});

/** Exclui uma sprint que ainda não começou; as tarefas dela voltam para o backlog. */
export const deleteSprintAction = createAction({
  name: "sprint.delete",
  schema: sprintIdSchema,
  handler: async ({ sprintId }, { userId }) => {
    const { sprint, history } = await loadSprint(sprintId, userId);
    if (sprint.status !== "PLANNED") fail("Só sprints planejadas podem ser excluídas.");

    await Task.updateMany({ sprintId: sprint._id }, { $set: { sprintId: null } });
    await Sprint.deleteOne({ _id: sprint._id });
    await history("DELETE", sprint);

    revalidateProjectPages();
    return { id: sprintId };
  },
});
