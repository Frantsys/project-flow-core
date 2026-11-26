"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { Comment, Project, Sprint, Task, User, Workspace } from "../db/models";
import { parseMentions } from "@/lib/mentions";
import { notify } from "../services/notification.service";
import { trashTask } from "../services/trash.service";
import { createAction, fail } from "../lib/action";
import { can } from "@/lib/permissions";
import { requirePermission } from "../lib/access";
import { recordHistory } from "../services/history.service";
import { placeTask, rankAtEnd } from "../lib/rank";
import { summarizeTask, suggestSubtasks } from "../lib/ai";
import { enforceRateLimit } from "../lib/rate-limit";
import {
  addCommentSchema,
  addSubtaskSchema,
  aiSubtasksSchema,
  editCommentSchema,
  commentRefSchema,
  createTaskSchema,
  subtaskRefSchema,
  taskIdSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  moveTaskSchema,
} from "../schemas";

interface ProjectForTaskLean {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  key: string;
  statuses: { _id: Types.ObjectId; name: string; category: string }[];
}

/** Procura o status no projeto pelo id (string). */
const findStatus = (project: ProjectForTaskLean, id: string | null | undefined) =>
  id ? project.statuses.find((s) => s._id.toString() === id) : undefined;

interface TaskLean {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  reporterId: Types.ObjectId;
  code: string;
  title: string;
  description?: string;
  type: string;
  statusId: Types.ObjectId;
  priority: string;
  storyPoints?: number | null;
  dueDate?: Date | null;
  tags?: string[];
  assigneeId?: Types.ObjectId | null;
  sprintId?: Types.ObjectId | null;
  subtasks: { _id: Types.ObjectId; title: string; isCompleted: boolean; order: number }[];
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

  const role = await requirePermission(project.workspaceId.toString(), userId, "task.edit");

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

  /** Endereço da tarefa e título como aparecem nas notificações. */
  const target = async () => {
    const ws = await Workspace.findById(project.workspaceId).select("slug").lean();
    return {
      title: `${task.code} ${task.title}`,
      href: `/w/${ws?.slug}/projects/${project.key}/tasks/${task.code}`,
    };
  };

  return { task, project, role, history, target };
}

/**
 * Cria uma tarefa no projeto. Qualquer membro do workspace pode criar.
 * O código (PF-12) vem do contador `taskSequence` do projeto, incrementado de forma atômica.
 */
export const createTaskAction = createAction({
  name: "task.create",
  schema: createTaskSchema,
  handler: async ({ projectId, title, type, priority, storyPoints, dueDate, statusId }, { userId }) => {
    await dbConnect();

    const project = await Project.findById(projectId)
      .select("workspaceId key statuses")
      .lean<ProjectForTaskLean>();
    if (!project) fail("Projeto não encontrado.");

    const role = await requirePermission(project.workspaceId.toString(), userId, "task.edit");

    // sem escolha: o primeiro status "A fazer" (ou o primeiro da lista)
    const status = statusId
      ? findStatus(project, statusId)
      : (project.statuses.find((s) => s.category === "TODO") ?? project.statuses[0]);
    if (!status) {
      fail("Status inválido para este projeto.", { statusId: ["Escolha um dos status do projeto."] });
    }

    // $inc é atômico: duas criações simultâneas nunca recebem o mesmo número
    const counter = await Project.findByIdAndUpdate(
      projectId,
      { $inc: { taskSequence: 1 } },
      { returnDocument: "after" }
    )
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
      statusId: status._id,
      rank: await rankAtEnd(project._id, status._id),
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
    const { task, project, history, target } = await loadTask(data.taskId, userId);

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
    if (data.statusId !== undefined) {
      const next = findStatus(project, data.statusId);
      if (!next) fail("Status inválido para este projeto.");
      // o histórico guarda os nomes do momento, para continuar legível se o status for renomeado
      const current = findStatus(project, task.statusId.toString());
      track("status", "statusId", task.statusId.toString(), data.statusId, [
        current?.name ?? null,
        next.name,
      ]);
      // trocou de coluna pelo menu ou pelo painel: entra no fim da nova coluna
      if (set.statusId) set.rank = await rankAtEnd(project._id, next._id);
    }
    if (data.dueDate !== undefined) {
      const oldDue = dateOnly(task.dueDate);
      if (oldDue !== data.dueDate) {
        set.dueDate = data.dueDate ? toDate(data.dueDate) : null;
        changes.push({ field: "dueDate", oldValue: oldDue, newValue: data.dueDate });
      }
    }

    if (data.tags !== undefined) {
      const old = (task.tags ?? []).join(", ");
      const next = data.tags.join(", ");
      if (old !== next) {
        set.tags = data.tags;
        changes.push({ field: "tags", oldValue: old || null, newValue: next || null });
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
      if (set.assigneeId) {
        await notify({
          type: "ASSIGNED",
          recipients: [String(set.assigneeId)],
          actorId: userId,
          workspaceId: project.workspaceId,
          taskId: task._id,
          ...(await target()),
        });
      }
      revalidateProjectPages();
    }

    return { id: data.taskId };
  },
});

/** Move a tarefa para outra coluna do quadro (atalho de updateTaskAction só com o status). */
export const updateTaskStatusAction = createAction({
  name: "task.updateStatus",
  schema: updateTaskStatusSchema,
  handler: async ({ taskId, statusId }) => {
    const result = await updateTaskAction({ taskId, statusId });
    if (!result.success) fail(result.error, result.fieldErrors);
    return { id: taskId, statusId };
  },
});

/**
 * Arrastar e soltar: põe a tarefa na coluna `statusId`, logo abaixo de `afterTaskId`
 * (null = topo). Mudança de coluna entra no histórico como mudança de status.
 */
export const moveTaskAction = createAction({
  name: "task.move",
  schema: moveTaskSchema,
  handler: async ({ taskId, statusId, afterTaskId, toEnd }, { userId }) => {
    const { task, project, history } = await loadTask(taskId, userId);
    const next = findStatus(project, statusId);
    if (!next) fail("Status inválido para este projeto.");
    if (afterTaskId === taskId) fail("Posição inválida.");

    if (task.statusId.toString() !== statusId) {
      await Task.updateOne({ _id: task._id }, { $set: { statusId: next._id } });
      await history("MODIFY", "TASK", {
        field: "status",
        oldValue: findStatus(project, task.statusId.toString())?.name ?? null,
        newValue: next.name,
      });
    }
    let rank: string;
    if (toEnd) {
      rank = await rankAtEnd(project._id, next._id);
      await Task.updateOne({ _id: task._id }, { $set: { rank } });
    } else {
      rank = await placeTask(task, next._id, afterTaskId ?? null);
    }

    revalidateProjectPages();
    return { id: taskId, statusId, rank };
  },
});

/**
 * Manda a tarefa para a lixeira (restaurável por 30 dias). Membros comuns só excluem tarefas que
 * eles mesmos criaram. Devolve o id do item da lixeira para o "Desfazer".
 */
export const deleteTaskAction = createAction({
  name: "task.delete",
  schema: taskIdSchema,
  handler: async ({ taskId }, { userId }) => {
    const { task, project, role, history } = await loadTask(taskId, userId);
    if (!can(role, "task.deleteAny") && task.reporterId.toString() !== userId) {
      fail("Só quem criou a tarefa, um admin ou o dono pode excluí-la.");
    }

    const trashId = await trashTask(task, project.workspaceId, userId);
    await history("DELETE", "TASK", {});

    revalidateProjectPages();
    return { id: taskId, trashId };
  },
});

const AI_DAILY_LIMIT = 50;

/** Monta o contexto da tarefa para a IA: descrição, subtarefas e os últimos comentários. */
async function aiContext(task: TaskLean) {
  const comments = await Comment.find({ taskId: task._id })
    .sort({ createdAt: -1 })
    .limit(30)
    .populate<{ authorId: { username: string } | null }>("authorId", "username")
    .lean();
  return {
    code: task.code,
    title: task.title,
    description: task.description ?? "",
    subtasks: task.subtasks.map((s) => ({ title: s.title, isCompleted: s.isCompleted })),
    comments: comments
      .reverse()
      .map((c) => ({ author: c.authorId?.username ?? "Alguém", content: c.content })),
  };
}

/** Limite de uso da IA por workspace e por dia (custo e abuso). */
const enforceAiLimit = (workspaceId: Types.ObjectId) =>
  enforceRateLimit(`ai:${workspaceId.toString()}`, AI_DAILY_LIMIT, 24 * 3_600_000);

/** Resume a tarefa com a IA e grava em aiSummary, que todo o time vê. */
export const summarizeTaskAction = createAction({
  name: "task.aiSummary",
  schema: taskIdSchema,
  handler: async ({ taskId }, { userId }) => {
    const { task, project } = await loadTask(taskId, userId);
    await enforceAiLimit(project.workspaceId);
    const summary = await summarizeTask(await aiContext(task));
    await Task.updateOne({ _id: task._id }, { $set: { aiSummary: summary } });
    revalidateProjectPages();
    return { summary };
  },
});

/** Sugere subtarefas; nada é gravado até a pessoa escolher quais quer. */
export const suggestSubtasksAction = createAction({
  name: "task.aiSubtasks",
  schema: taskIdSchema,
  handler: async ({ taskId }, { userId }) => {
    const { task, project } = await loadTask(taskId, userId);
    await enforceAiLimit(project.workspaceId);
    return { subtasks: await suggestSubtasks(await aiContext(task)) };
  },
});

/** Adiciona as subtarefas sugeridas que a pessoa escolheu, marcadas como geradas pela IA. */
export const addAiSubtasksAction = createAction({
  name: "task.addAiSubtasks",
  schema: aiSubtasksSchema,
  handler: async ({ taskId, titles }, { userId }) => {
    const { task, history } = await loadTask(taskId, userId);
    if (task.subtasks.length + titles.length > 100) fail("A tarefa já tem subtarefas demais.");
    let order = task.subtasks.reduce((max, s) => Math.max(max, s.order), -1);
    const created = titles.map((title) => ({
      _id: new Types.ObjectId(),
      title,
      order: ++order,
      isCompleted: false,
      generatedByAi: true,
    }));
    await Task.updateOne({ _id: task._id }, { $push: { subtasks: { $each: created } } });
    await Promise.all(
      created.map((s) => history("CREATE", "SUBTASK", { field: "subtask", newValue: s.title }, s._id))
    );
    revalidateProjectPages();
    return { added: created.length };
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

/** Membros do workspace com nome, para achar as menções do texto. */
async function workspaceMembers(workspaceId: Types.ObjectId) {
  const ws = await Workspace.findById(workspaceId)
    .select("members.userId")
    .populate<{ members: { userId: { _id: Types.ObjectId; username: string } | null }[] }>(
      "members.userId",
      "username"
    )
    .lean();
  return (ws?.members ?? []).flatMap((m) =>
    m.userId ? [{ id: m.userId._id.toString(), name: m.userId.username }] : []
  );
}

/**
 * Comenta na tarefa. Quem foi mencionado com @Nome recebe "mencionou você"; criador, responsável e
 * quem já comentou recebem "comentou" (sem aviso duplicado para quem foi mencionado).
 */
export const addCommentAction = createAction({
  name: "task.addComment",
  schema: addCommentSchema,
  handler: async ({ taskId, content }, { userId }) => {
    const { task, project, history, target } = await loadTask(taskId, userId);
    const { ids: mentions } = parseMentions(content, await workspaceMembers(project.workspaceId));

    const comment = await Comment.create({
      taskId: task._id,
      projectId: project._id,
      workspaceId: project.workspaceId,
      authorId: userId,
      content,
      mentions,
    });
    await history("CREATE", "COMMENT", {}, comment._id);

    const where = await target();
    const base = { actorId: userId, workspaceId: project.workspaceId, taskId: task._id, ...where };
    await notify({ ...base, type: "MENTIONED", recipients: mentions });
    const previous = await Comment.distinct("authorId", { taskId: task._id });
    const followers = [task.reporterId, task.assigneeId, ...previous]
      .filter(Boolean)
      .map(String)
      .filter((id) => !mentions.includes(id));
    await notify({ ...base, type: "COMMENTED", recipients: followers });

    revalidateProjectPages();
    return { id: comment._id.toString() };
  },
});

/** Edita o próprio comentário. Só avisa quem passou a ser mencionado agora. */
export const editCommentAction = createAction({
  name: "task.editComment",
  schema: editCommentSchema,
  handler: async ({ taskId, commentId, content }, { userId }) => {
    const { task, project, target } = await loadTask(taskId, userId);
    const comment = await Comment.findOne({ _id: commentId, taskId: task._id }).lean();
    if (!comment) fail("Comentário não encontrado.");
    if (comment.authorId.toString() !== userId) fail("Você só pode editar os seus comentários.");

    const { ids: mentions } = parseMentions(content, await workspaceMembers(project.workspaceId));
    await Comment.updateOne({ _id: comment._id }, { $set: { content, mentions, editedAt: new Date() } });

    const before = new Set(comment.mentions.map(String));
    await notify({
      type: "MENTIONED",
      recipients: mentions.filter((id) => !before.has(id)),
      actorId: userId,
      workspaceId: project.workspaceId,
      taskId: task._id,
      ...(await target()),
    });

    revalidateProjectPages();
    return { id: commentId };
  },
});

export const deleteCommentAction = createAction({
  name: "task.deleteComment",
  schema: commentRefSchema,
  handler: async ({ taskId, commentId }, { userId }) => {
    const { task, project, role, history } = await loadTask(taskId, userId);

    const comment = await Comment.findOne({ _id: commentId, taskId: task._id }).select("authorId").lean();
    if (!comment) fail("Comentário não encontrado.");
    if (!can(role, "comment.deleteAny") && comment.authorId.toString() !== userId) {
      fail("Você só pode excluir os seus comentários.");
    }

    await Comment.deleteOne({ _id: comment._id });
    await history("DELETE", "COMMENT", {}, comment._id);

    revalidateProjectPages();
    return { id: commentId };
  },
});
