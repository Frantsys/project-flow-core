"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { Project, Sprint, Task, User, Workspace } from "../db/models";
import { createAction, fail } from "../lib/action";
import { ALL_ROLES, requireWorkspaceRole } from "../lib/access";
import { recordHistory } from "../services/history.service";
import {
  addCommentSchema,
  addSubtaskSchema,
  commentRefSchema,
  createTaskSchema,
  subtaskRefSchema,
  taskIdSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from "../schemas";

interface ProjectForTaskLean {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  key: string;
  statuses: string[];
}

interface TaskLean {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  reporterId: Types.ObjectId;
  code: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: string;
  storyPoints?: number | null;
  dueDate?: Date | null;
  assigneeId?: Types.ObjectId | null;
  sprintId?: Types.ObjectId | null;
  subtasks: { _id: Types.ObjectId; title: string; isCompleted: boolean; order: number }[];
  comments: { _id: Types.ObjectId; authorId: Types.ObjectId }[];
}

type HistoryDetails = {
  targetTitle?: string;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
};

function revalidateProjectPages() {
  revalidatePath("/w/[workspaceSlug]/projects/[projectKey]", "layout");
}

const dateOnly = (d?: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const toDate = (d: string) => new Date(`${d}T00:00:00.000Z`);

/**
 * Carrega tarefa + projeto e confere que o usuário é membro do workspace.
 * Toda action de tarefa passa por aqui, então a regra de acesso fica num lugar só.
 */
async function loadTask(taskId: string, userId: string) {
  await dbConnect();

  const task = await Task.findById(taskId).lean<TaskLean>();
  if (!task) fail("Tarefa não encontrada.");

  const project = await Project.findById(task.projectId)
    .select("workspaceId key statuses")
    .lean<ProjectForTaskLean>();
  if (!project) fail("Projeto não encontrado.");

  const role = await requireWorkspaceRole(project.workspaceId.toString(), userId, ALL_ROLES);

  const history = (
    action: "CREATE" | "MODIFY" | "DELETE",
    targetType: "TASK" | "SUBTASK" | "COMMENT",
    details: HistoryDetails,
    targetId: Types.ObjectId | string = task._id
  ) =>
    recordHistory({
      workspaceId: project.workspaceId,
      projectId: project._id,
      userId,
      actorRole: role,
      action,
      targetType,
      targetId,
      parentId: targetType === "TASK" ? null : task._id,
      details: { targetTitle: `${task.code} ${task.title}`, ...details },
    });

  return { task, project, role, history };
}

/**
 * Cria uma tarefa no projeto. Qualquer membro do workspace pode criar.
 * O código (PF-12) vem do contador `taskSequence` do projeto, incrementado de forma atômica.
 */
export const createTaskAction = createAction({
  name: "task.create",
  schema: createTaskSchema,
  handler: async ({ projectId, title, type, priority, storyPoints, dueDate, status: wanted }, { userId }) => {
    await dbConnect();

    const project = await Project.findById(projectId)
      .select("workspaceId key statuses")
      .lean<ProjectForTaskLean>();
    if (!project) fail("Projeto não encontrado.");

    const role = await requireWorkspaceRole(project.workspaceId.toString(), userId, ALL_ROLES);

    const status = wanted || project.statuses[0];
    if (!status || !project.statuses.includes(status)) {
      fail("Status inválido para este projeto.", { status: ["Escolha um dos status do projeto."] });
    }

    // $inc é atômico: duas criações simultâneas nunca recebem o mesmo número
    const counter = await Project.findByIdAndUpdate(projectId, { $inc: { taskSequence: 1 } }, { new: true })
      .select("taskSequence")
      .lean<{ taskSequence: number }>();
    if (!counter) fail("Projeto não encontrado.");

    const code = `${project.key}-${counter.taskSequence}`;
    const task = await Task.create({
      projectId,
      reporterId: userId,
      code,
      title,
      type,
      priority,
      status,
      storyPoints: storyPoints ?? null,
      dueDate: dueDate ? toDate(dueDate) : null,
    });

    await recordHistory({
      workspaceId: project.workspaceId,
      projectId: project._id,
      userId,
      actorRole: role,
      action: "CREATE",
      targetType: "TASK",
      targetId: task._id,
      details: { targetTitle: `${code} ${title}` },
    });

    revalidateProjectPages();
    return { id: task._id.toString(), code };
  },
});

/**
 * Edita qualquer campo da tarefa. Só grava o que mudou e registra uma entrada de histórico por campo.
 * Responsável precisa ser membro do workspace; sprint precisa ser do mesmo projeto e não concluída.
 */
export const updateTaskAction = createAction({
  name: "task.update",
  schema: updateTaskSchema,
  handler: async (data, { userId }) => {
    const { task, project, history } = await loadTask(data.taskId, userId);

    const set: Record<string, unknown> = {};
    const changes: HistoryDetails[] = [];
    const track = (
      field: string,
      key: string,
      oldValue: unknown,
      newValue: unknown,
      label?: [string | null, string | null]
    ) => {
      if ((oldValue ?? null) === (newValue ?? null)) return;
      set[key] = newValue;
      changes.push({
        field,
        oldValue: label ? label[0] : oldValue == null ? null : String(oldValue),
        newValue: label ? label[1] : newValue == null ? null : String(newValue),
      });
    };

    if (data.title !== undefined) track("title", "title", task.title, data.title);
    if (data.description !== undefined && (task.description ?? "") !== data.description) {
      // descrição longa: o histórico guarda só que ela mudou, não o texto inteiro
      set.description = data.description;
      changes.push({ field: "description", oldValue: null, newValue: null });
    }
    if (data.type !== undefined) track("type", "type", task.type, data.type);
    if (data.priority !== undefined) track("priority", "priority", task.priority, data.priority);
    if (data.storyPoints !== undefined)
      track("storyPoints", "storyPoints", task.storyPoints ?? null, data.storyPoints);
    if (data.status !== undefined) {
      if (!project.statuses.includes(data.status)) fail("Status inválido para este projeto.");
      track("status", "status", task.status, data.status);
    }
    if (data.dueDate !== undefined) {
      const oldDue = dateOnly(task.dueDate);
      if (oldDue !== data.dueDate) {
        set.dueDate = data.dueDate ? toDate(data.dueDate) : null;
        changes.push({ field: "dueDate", oldValue: oldDue, newValue: data.dueDate });
      }
    }

    if (data.assigneeId !== undefined) {
      const oldId = task.assigneeId?.toString() ?? null;
      if (oldId !== data.assigneeId) {
        if (data.assigneeId) {
          const isMember = await Workspace.exists({
            _id: project.workspaceId,
            "members.userId": data.assigneeId,
          });
          if (!isMember) fail("O responsável precisa ser membro do workspace.");
        }
        const ids = [oldId, data.assigneeId].filter(Boolean) as string[];
        const people = await User.find({ _id: { $in: ids } })
          .select("username")
          .lean<{ _id: Types.ObjectId; username: string }[]>();
        const name = (id: string | null) =>
          id ? (people.find((p) => p._id.toString() === id)?.username ?? null) : null;
        track("assignee", "assigneeId", oldId, data.assigneeId, [name(oldId), name(data.assigneeId)]);
      }
    }

    if (data.sprintId !== undefined) {
      const oldId = task.sprintId?.toString() ?? null;
      if (oldId !== data.sprintId) {
        const ids = [oldId, data.sprintId].filter(Boolean) as string[];
        const sprints = await Sprint.find({ _id: { $in: ids }, projectId: project._id })
          .select("name status")
          .lean<{ _id: Types.ObjectId; name: string; status: string }[]>();
        const target = sprints.find((s) => s._id.toString() === data.sprintId);
        if (data.sprintId && !target) fail("Sprint não encontrada neste projeto.");
        if (target?.status === "COMPLETED") fail("Não é possível adicionar tarefas a uma sprint concluída.");
        const name = (id: string | null) =>
          id ? (sprints.find((s) => s._id.toString() === id)?.name ?? null) : null;
        track("sprint", "sprintId", oldId, data.sprintId, [name(oldId), name(data.sprintId)]);
      }
    }

    if (changes.length > 0) {
      await Task.updateOne({ _id: task._id }, { $set: set }, { runValidators: true });
      await Promise.all(changes.map((c) => history("MODIFY", "TASK", c)));
      revalidateProjectPages();
    }

    return { id: data.taskId };
  },
});

/** Move a tarefa para outra coluna do quadro (atalho de updateTaskAction só com o status). */
export const updateTaskStatusAction = createAction({
  name: "task.updateStatus",
  schema: updateTaskStatusSchema,
  handler: async ({ taskId, status }) => {
    const result = await updateTaskAction({ taskId, status });
    if (!result.success) fail(result.error, result.fieldErrors);
    return { id: taskId, status };
  },
});

/** Exclui a tarefa. Membros comuns só excluem tarefas que eles mesmos criaram. */
export const deleteTaskAction = createAction({
  name: "task.delete",
  schema: taskIdSchema,
  handler: async ({ taskId }, { userId }) => {
    const { task, role, history } = await loadTask(taskId, userId);
    if (role === "MEMBER" && task.reporterId.toString() !== userId) {
      fail("Só quem criou a tarefa, um admin ou o dono pode excluí-la.");
    }

    await Task.deleteOne({ _id: task._id });
    await history("DELETE", "TASK", {});

    revalidateProjectPages();
    return { id: taskId };
  },
});

export const addSubtaskAction = createAction({
  name: "task.addSubtask",
  schema: addSubtaskSchema,
  handler: async ({ taskId, title }, { userId }) => {
    const { task, history } = await loadTask(taskId, userId);

    const subtaskId = new Types.ObjectId();
    const order = task.subtasks.reduce((max, s) => Math.max(max, s.order), -1) + 1;
    await Task.updateOne(
      { _id: task._id },
      { $push: { subtasks: { _id: subtaskId, title, order, isCompleted: false, generatedByAi: false } } }
    );
    await history("CREATE", "SUBTASK", { field: "subtask", newValue: title }, subtaskId);

    revalidateProjectPages();
    return { id: subtaskId.toString() };
  },
});

export const toggleSubtaskAction = createAction({
  name: "task.toggleSubtask",
  schema: subtaskRefSchema,
  handler: async ({ taskId, subtaskId }, { userId }) => {
    const { task, history } = await loadTask(taskId, userId);

    const subtask = task.subtasks.find((s) => s._id.toString() === subtaskId);
    if (!subtask) fail("Subtarefa não encontrada.");

    const isCompleted = !subtask.isCompleted;
    await Task.updateOne(
      { _id: task._id, "subtasks._id": subtask._id },
      { $set: { "subtasks.$.isCompleted": isCompleted } }
    );
    await history(
      "MODIFY",
      "SUBTASK",
      { field: "subtask", oldValue: subtask.title, newValue: isCompleted ? "concluída" : "reaberta" },
      subtask._id
    );

    revalidateProjectPages();
    return { isCompleted };
  },
});

export const deleteSubtaskAction = createAction({
  name: "task.deleteSubtask",
  schema: subtaskRefSchema,
  handler: async ({ taskId, subtaskId }, { userId }) => {
    const { task, history } = await loadTask(taskId, userId);

    const subtask = task.subtasks.find((s) => s._id.toString() === subtaskId);
    if (!subtask) fail("Subtarefa não encontrada.");

    await Task.updateOne({ _id: task._id }, { $pull: { subtasks: { _id: subtask._id } } });
    await history("DELETE", "SUBTASK", { field: "subtask", oldValue: subtask.title }, subtask._id);

    revalidateProjectPages();
    return { id: subtaskId };
  },
});

export const addCommentAction = createAction({
  name: "task.addComment",
  schema: addCommentSchema,
  handler: async ({ taskId, content }, { userId }) => {
    const { task, history } = await loadTask(taskId, userId);

    const commentId = new Types.ObjectId();
    await Task.updateOne(
      { _id: task._id },
      { $push: { comments: { _id: commentId, authorId: userId, content, createdAt: new Date() } } }
    );
    await history("CREATE", "COMMENT", {}, commentId);

    revalidateProjectPages();
    return { id: commentId.toString() };
  },
});

/** Exclui um comentário: o autor, um admin ou o dono do workspace. */
export const deleteCommentAction = createAction({
  name: "task.deleteComment",
  schema: commentRefSchema,
  handler: async ({ taskId, commentId }, { userId }) => {
    const { task, role, history } = await loadTask(taskId, userId);

    const comment = task.comments.find((c) => c._id.toString() === commentId);
    if (!comment) fail("Comentário não encontrado.");
    if (role === "MEMBER" && comment.authorId.toString() !== userId) {
      fail("Você só pode excluir os seus comentários.");
    }

    await Task.updateOne({ _id: task._id }, { $pull: { comments: { _id: comment._id } } });
    await history("DELETE", "COMMENT", {}, comment._id);

    revalidateProjectPages();
    return { id: commentId };
  },
});
