"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { CreateCommentInput, createCommentSchema, CreateSubtaskInput, createSubtaskSchema, CreateTaskInput, createTaskSchema, DeleteCommentInput, deleteCommentSchema, DeleteSubtaskInput, deleteSubtaskSchema, DeleteTaskInput, deleteTaskSchema, ToggleSubtaskInput, toggleSubtaskSchema, UpdateTaskInput, updateTaskSchema } from "../schemas";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import { ActionResult } from "@/types";
import { Project, Sprint, Workspace, Task, ChangeHistory, WorkspaceRole } from "../db/models";
import { verifyWorkspacePermission } from "../services/permission.service";
import z from "zod";
import { TaskPriority, TaskType } from "../db/types";
import { recordChangeHistory } from "../services/change_history.service";
import { notifyWorkspace } from "../notifications";


interface ProjectTargetLean {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  key: string;
  statuses: string[];
}


export async function createTaskAction(
  input: CreateTaskInput
): Promise<
  ActionResult<{
    id: string;
    code: string;
    title: string;
    status: string;
  }>
> {
  try {
    // 1. Autenticação
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada. Faça login novamente." };
    }

    // 2. Validação Zod
    const parsed = createTaskSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados inválidos.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    }

    const {
      projectId,
      title,
      description,
      type,
      status,
      priority,
      storyPoints,
      dueDate,
      sprintId,
      assigneeId,
    } = parsed.data;

    await dbConnect();


    const project = await Project.findById(projectId)
      .select("_id workspaceId key statuses")
      .lean<ProjectTargetLean>();

    if (!project) {
      return { success: false, error: "Projeto não encontrado." };
    }

    // qualquer membro do workspace pode criar tarefas
    const permission = await verifyWorkspacePermission({
      workspaceId: project.workspaceId.toString(),
      userId: session.user.id,
      allowedRoles: ["OWNER", "ADMIN", "MEMBER"],
    });

    if (!permission.authorized) {
      return { success: false, error: permission.error };
    }

    const defaultStatus = project.statuses[0] ?? "TODO";
    const resolvedStatus = status ?? defaultStatus;

    if (
      project.statuses.length > 0 &&
      !project.statuses.includes(resolvedStatus)
    ) {
      return {
        success: false,
        error: "Status inválido para este projeto.",
        fieldErrors: {
          status: [`Status deve ser um dos valores: ${project.statuses.join(", ")}.`],
        },
      };
    }

    // valida integridade referencial de sprintId e assigneeId dentro do mesmo workspace
    const [validSprint, validAssignee] = await Promise.all([
      sprintId ? Sprint.exists({ _id: sprintId, projectId: project._id }) : Promise.resolve(true),
      assigneeId ? Workspace.exists({
            _id: project.workspaceId,
            "members.userId": assigneeId,
          }) : Promise.resolve(true),
    ]);

    if (!validSprint) {
      return {
        success: false,
        error: "A sprint selecionada não pertence a este projeto.",
        fieldErrors: { sprintId: ["Sprint inválida para este projeto."] },
      };
    }

    if (!validAssignee) {
      return {
        success: false,
        error: "O responsável selecionado não é membro deste workspace.",
        fieldErrors: { assigneeId: ["Usuário não pertence ao workspace."] },
      };
    }

    // 7. Incremento atômico do contador do projeto para gerar a key (ex: WEB-14)
    const updatedProject = await Project.findByIdAndUpdate(
      project._id,
      { $inc: { taskSequence: 1 } },
      { new: true }
    )
      .select("taskSequence")
      .lean<{ taskSequence: number }>();

    if (!updatedProject) {
      return { success: false, error: "Erro ao gerar identificador da tarefa." };
    }

    const taskKey = `${project.key}-${updatedProject.taskSequence}`;

    const task = await Task.create({
      projectId: project._id,
      code: taskKey,
      title,
      description: description ?? "",
      type,
      status: resolvedStatus,
      priority,
      storyPoints: storyPoints ?? null,
      dueDate: dueDate ?? null,
      sprintId: sprintId ?? null,
      assigneeId: assigneeId ?? null,
      reporterId: session.user.id,
    });

    notifyWorkspace({
      workspaceId: project.workspaceId.toString(),
      entityType: "TASK",
      entityId: task._id.toString(),
      action: "CREATED",
      message: `criou a tarefa ${task.code}: ${task.title}`,
      actor: {
        id: session.user.id,
        name: session.user.name ?? "Membro",
      },
    });

    revalidatePath("/", "layout");

    await recordChangeHistory({
      workspaceId: project.workspaceId,
      targetType: "TASK",
      targetId: task._id,
      parentId: project._id,
      actorId: session.user.id,
      action: "CREATED",
      summary: `criou a tarefa ${task.code}: ${task.title}`,
      details: {
        code: task.code,
        status: task.status,
        type: task.type,
        priority: task.priority,
      },
    });

    return {
      success: true,
      data: {
        id: task._id.toString(),
        code: task.code,
        title: task.title,
        status: task.status,
      },
    };
  } catch (error) {
    console.error("[createTaskAction]:", error);
    return {
      success: false,
      error: "Erro interno ao criar a tarefa.",
    };
  }
}




interface ExistingTaskLean {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  reporterId: Types.ObjectId;
  assigneeId?: Types.ObjectId | null;
}

interface ProjectValidationLean {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  statuses: string[];
}

interface UpdatedTaskLean {
  _id: Types.ObjectId;
  code: string;
  title: string;
  type: TaskType;
  status: string;
  priority: TaskPriority;
}

export async function updateTaskAction(
  input: UpdateTaskInput
): Promise<
  ActionResult<{
    id: string;
    code: string;
    title: string;
    type: TaskType;
    status: string;
    priority: TaskPriority;
  }>
> {
  try {
    // 1. Autenticação
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada. Faça login novamente." };
    }

    // 2. Validação Zod
    const parsed = updateTaskSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados inválidos.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const {
      taskId,
      title,
      description,
      type,
      status,
      priority,
      storyPoints,
      dueDate,
      sprintId,
      assigneeId,
    } = parsed.data;

    await dbConnect();


    const existingTask = await Task.findById(taskId)
      .select("_id projectId reporterId assigneeId")
      .lean<ExistingTaskLean>();

    if (!existingTask) {
      return { success: false, error: "Tarefa não encontrada." };
    }

    const project = await Project.findById(existingTask.projectId)
      .select("_id workspaceId statuses")
      .lean<ProjectValidationLean>();

    if (!project) {
      return { success: false, error: "Projeto associado não encontrado." };
    }

    // autorização
    const permission = await verifyWorkspacePermission({
      workspaceId: project.workspaceId.toString(),
      userId: session.user.id,
      allowedRoles: ["OWNER", "ADMIN", "MEMBER"],
    });

    if (!permission.authorized) {
      return { success: false, error: permission.error };
    }

    // se for um membro, valida se ele criou a tarefa ou se ela foi atribuída a ele
    if (permission.role === "MEMBER") {
      const isReporter = existingTask.reporterId.toString() === session.user.id;
      const isAssignee = existingTask.assigneeId?.toString() === session.user.id;

      if (!isReporter && !isAssignee) {
        return {
          success: false,
          error:
            "Membros só podem editar ou mover tarefas criadas por eles ou atribuídas a eles.",
        };
      }
    }

    // valida se o novo status pertence às colunas configuradas no projeto
    if (
      status !== undefined &&
      project.statuses.length > 0 &&
      !project.statuses.includes(status)
    ) {
      return {
        success: false,
        error: "Status inválido para este projeto.",
        fieldErrors: {
          status: [
            `Status deve ser um dos valores: ${project.statuses.join(", ")}.`,
          ],
        },
      };
    }

    // valida integridade referencial caso sprintId ou assigneeId sejam alterados
    const [validSprint, validAssignee] = await Promise.all([
      sprintId
        ? Sprint.exists({ _id: sprintId, projectId: project._id })
        : Promise.resolve(true),
      assigneeId
        ? Workspace.exists({
            _id: project.workspaceId,
            "members.userId": assigneeId,
          })
        : Promise.resolve(true),
    ]);

    if (!validSprint) {
      return {
        success: false,
        error: "A sprint selecionada não pertence a este projeto.",
        fieldErrors: { sprintId: ["Sprint inválida para este projeto."] },
      };
    }

    if (!validAssignee) {
      return {
        success: false,
        error: "O responsável selecionado não é membro deste workspace.",
        fieldErrors: { assigneeId: ["Usuário não pertence ao workspace."] },
      };
    }

    // update parcial apenas com os campos enviados
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description ?? "";
    if (type !== undefined) updateData.type = type;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (storyPoints !== undefined) updateData.storyPoints = storyPoints;
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (sprintId !== undefined) updateData.sprintId = sprintId;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;

    const updated = await Task.findByIdAndUpdate(
      taskId,
      { $set: updateData },
      { new: true, runValidators: true }
    ) 
      .select("_id code title type status priority")
      .lean<UpdatedTaskLean>();

    if (!updated) {
      return { success: false, error: "Erro ao localizar a tarefa atualizada." };
    }

    revalidatePath("/", "layout");


    const taskAction = status !== undefined ? "STATUS_CHANGED"
    : assigneeId !== undefined
      ? "ASSIGNED"
      : "UPDATED";

    const taskSummary =
      status !== undefined
        ? `moveu ${updated.code} para ${updated.status}`
        : assigneeId !== undefined
          ? assigneeId
            ? `atribuiu a tarefa ${updated.code}`
            : `removeu o responsável de ${updated.code}`
          : `atualizou a tarefa ${updated.code}`;



    await recordChangeHistory({
      workspaceId: project.workspaceId,
      targetType: "TASK",
      targetId: updated._id,
      parentId: project._id,
      actorId: session.user.id,
      action: taskAction,
      summary: taskSummary,
      details: {
        code: updated.code,
        status: updated.status,
        updatedFields: Object.keys(updateData),
      },
    });

    return {
      success: true,
      data: {
        id: updated._id.toString(),
        code: updated.code,
        title: updated.title,
        type: updated.type,
        status: updated.status,
        priority: updated.priority,
      },
    };
  } catch (error) {
    console.error("[updateTaskAction]:", error);
    return {
      success: false,
      error: "Erro interno ao atualizar a tarefa.",
    };
  }
}





export async function deleteTaskAction(
  input: DeleteTaskInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada. Faça login novamente." };
    }

    const parsed = deleteTaskSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados inválidos.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { taskId } = parsed.data;

    await dbConnect();

    const existingTask = await Task.findById(taskId)
      .select("_id projectId reporterId code title")
      .lean<{
        _id: Types.ObjectId;
        projectId: Types.ObjectId;
        reporterId: Types.ObjectId;
        code: string;
        title: string
      }>();

    if (!existingTask) {
      return { success: false, error: "Tarefa não encontrada." };
    }

    const project = await Project.findById(existingTask.projectId)
      .select("_id workspaceId")
      .lean<{ _id: Types.ObjectId, workspaceId: Types.ObjectId }>();

    if (!project) {
      return { success: false, error: "Projeto associado não encontrado." };
    }

    const permission = await verifyWorkspacePermission({
      workspaceId: project.workspaceId.toString(),
      userId: session.user.id,
      allowedRoles: ["OWNER", "ADMIN", "MEMBER"],
    });

    if (!permission.authorized) {
      return { success: false, error: permission.error };
    }

    // MEMBER só pode excluir tarefas criadas por ele mesmo
    if (
      permission.role === "MEMBER" &&
      existingTask.reporterId.toString() !== session.user.id
    ) {
      return {
        success: false,
        error: "Membros só podem excluir tarefas criadas por eles.",
      };
    }

    await ChangeHistory.deleteMany({
      $or: [{ targetId: existingTask._id }, { parentId: existingTask._id }],
    });

    // Remove a Task junto com os arrays embutidos de subtasks e comments
    await Task.findByIdAndDelete(taskId);

    revalidatePath("/", "layout");

    await recordChangeHistory({
      workspaceId: project.workspaceId,
      targetType: "TASK",
      targetId: existingTask._id,
      parentId: project._id,
      actorId: session.user.id,
      action: "DELETED",
      summary: `excluiu a tarefa ${existingTask.code}: ${existingTask.title}`,
      details: { code: existingTask.code, title: existingTask.title },
    });

    return {
      success: true,
      data: { id: taskId },
    };
  } catch (error) {
    console.error("[deleteTaskAction]:", error);
    return {
      success: false,
      error: "Erro interno ao excluir a tarefa.",
    };
  }

}



interface TaskAuthContext {
  taskId: Types.ObjectId;
  projectId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  taskCode: string;
  role: WorkspaceRole;
  isReporterOrAssignee: boolean;
}

// Helper para validar permissões nas operações com Task
async function resolveTaskPermission(
  taskId: string,
  userId: string
): Promise<{ ok: true; ctx: TaskAuthContext } | { ok: false; error: string }> {
  await dbConnect();

  const task = await Task.findById(taskId)
    .select("_id projectId reporterId assigneeId code")
    .lean<{
      _id: Types.ObjectId;
      projectId: Types.ObjectId;
      reporterId: Types.ObjectId;
      assigneeId?: Types.ObjectId | null;
      code: string
    }>();

  if (!task) {
    return { ok: false, error: "Tarefa não encontrada." };
  }

  const project = await Project.findById(task.projectId)
    .select("workspaceId")
    .lean<{ workspaceId: Types.ObjectId }>();

  if (!project) {
    return { ok: false, error: "Projeto não encontrado." };
  }

  const permission = await verifyWorkspacePermission({
    workspaceId: project.workspaceId.toString(),
    userId,
    allowedRoles: ["OWNER", "ADMIN", "MEMBER"],
  });

  if (!permission.authorized) {
    return { ok: false, error: permission.error ?? "Permissão negada." };
  }

  const isReporterOrAssignee =
    task.reporterId.toString() === userId ||
    task.assigneeId?.toString() === userId;

  return {
    ok: true,
    ctx: {
      taskId: task._id,
      role: permission.role!,
      isReporterOrAssignee,
      taskCode: task.code,
      projectId: task.projectId,
      workspaceId: project.workspaceId
    },
  };
}


export async function createSubtaskAction(
  input: CreateSubtaskInput
): Promise<
  ActionResult<{
    id: string;
    title: string;
    isCompleted: boolean;
    generatedByAi: boolean;
    order: number;
  }>
> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada." };
    }

    const parsed = createSubtaskSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados inválidos.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    }

    const auth = await resolveTaskPermission(parsed.data.taskId, session.user.id);
    if (!auth.ok) return { success: false, error: auth.error };

    if (auth.ctx.role === "MEMBER" && !auth.ctx.isReporterOrAssignee) {
      return { success: false, error: "Sem permissão para alterar subtarefas desta tarefa." };
    }

    const currentTask = await Task.findById(auth.ctx.taskId)
      .select("subtasks")
      .lean<{ subtasks?: Array<{ order?: number }> }>();

    const nextOrder = currentTask?.subtasks?.length ?? 0;

    const updated = await Task.findByIdAndUpdate(
      auth.ctx.taskId,
      {
        $push: {
          subtasks: {
            title: parsed.data.title,
            isCompleted: false,
            generatedByAi: parsed.data.generatedByAi,
            order: nextOrder,
          },
        },
      },
      { new: true }
    )
      .select("subtasks")
      .lean<{
        subtasks: Array<{
          _id: Types.ObjectId;
          title: string;
          isCompleted: boolean;
          generatedByAi: boolean;
          order: number;
        }>;
      }>();

    const created = updated?.subtasks.at(-1);
    if (!created) {
      return { success: false, error: "Erro ao criar subtarefa." };
    }

    revalidatePath("/", "layout");

    await recordChangeHistory({
      workspaceId: auth.ctx.workspaceId,
      targetType: "TASK",
      targetId: auth.ctx.taskId,
      parentId: auth.ctx.projectId,
      actorId: session.user.id,
      action: "UPDATED",
      summary: `adicionou a subtarefa "${created.title}" em ${auth.ctx.taskCode}`,
      details: {
        subtaskId: created._id.toString(),
        title: created.title,
        generatedByAi: created.generatedByAi,
      },
    });

    return {
      success: true,
      data: {
        id: created._id.toString(),
        title: created.title,
        isCompleted: created.isCompleted,
        generatedByAi: created.generatedByAi,
        order: created.order,
      },
    };
  } catch (error) {
    console.error("[createSubtaskAction]:", error);
    return { success: false, error: "Erro interno ao criar subtarefa." };
  }
}




export async function toggleSubtaskAction(
  input: ToggleSubtaskInput
): Promise<ActionResult<{ id: string; isCompleted: boolean }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada." };
    }

    const parsed = toggleSubtaskSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Dados inválidos." };
    }

    const auth = await resolveTaskPermission(parsed.data.taskId, session.user.id);
    if (!auth.ok) return { success: false, error: auth.error };

    if (auth.ctx.role === "MEMBER" && !auth.ctx.isReporterOrAssignee) {
      return { success: false, error: "Sem permissão para alterar subtarefas desta tarefa." };
    }

    const result = await Task.updateOne(
      { _id: auth.ctx.taskId, "subtasks._id": parsed.data.subtaskId },
      { $set: { "subtasks.$.isCompleted": parsed.data.isCompleted } }
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "Subtarefa não encontrada." };
    }

    revalidatePath("/", "layout");

    await recordChangeHistory({
      workspaceId: auth.ctx.workspaceId,
      targetType: "TASK",
      targetId: auth.ctx.taskId,
      parentId: auth.ctx.projectId,
      actorId: session.user.id,
      action: "UPDATED",
      summary: `${parsed.data.isCompleted ? "concluiu" : "reabriu"} uma subtarefa em ${auth.ctx.taskCode}`,
      details: {
        subtaskId: parsed.data.subtaskId,
        isCompleted: parsed.data.isCompleted,
      },
    });

    return {
      success: true,
      data: { id: parsed.data.subtaskId, isCompleted: parsed.data.isCompleted },
    };
  } catch (error) {
    console.error("[toggleSubtaskAction]:", error);
    return { success: false, error: "Erro interno ao atualizar subtarefa." };
  }
}




export async function deleteSubtaskAction(
  input: DeleteSubtaskInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada." };
    }

    const parsed = deleteSubtaskSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Dados inválidos." };
    }

    const auth = await resolveTaskPermission(parsed.data.taskId, session.user.id);
    if (!auth.ok) return { success: false, error: auth.error };

    if (auth.ctx.role === "MEMBER" && !auth.ctx.isReporterOrAssignee) {
      return { success: false, error: "Sem permissão para remover subtarefas desta tarefa." };
    }

    await Task.updateOne(
      { _id: auth.ctx.taskId },
      { $pull: { subtasks: { _id: parsed.data.subtaskId } } }
    );

    revalidatePath("/", "layout");

    await recordChangeHistory({
      workspaceId: auth.ctx.workspaceId,
      targetType: "TASK",
      targetId: auth.ctx.taskId,
      parentId: auth.ctx.projectId,
      actorId: session.user.id,
      action: "UPDATED",
      summary: `removeu uma subtarefa de ${auth.ctx.taskCode}`,
      details: { subtaskId: parsed.data.subtaskId },
    });

    return { success: true, data: { id: parsed.data.subtaskId } };
  } catch (error) {
    console.error("[deleteSubtaskAction]:", error);
    return { success: false, error: "Erro interno ao excluir subtarefa." };
  }
}


export async function createCommentAction(
  input: CreateCommentInput
): Promise<ActionResult<{ id: string; content: string; createdAt: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada." };
    }

    const parsed = createCommentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados inválidos.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    }

    // Qualquer membro do workspace pode comentar em tarefas
    const auth = await resolveTaskPermission(parsed.data.taskId, session.user.id);
    if (!auth.ok) return { success: false, error: auth.error };

    const updated = await Task.findByIdAndUpdate(
      auth.ctx.taskId,
      {
        $push: {
          comments: {
            content: parsed.data.content,
            authorId: session.user.id,
          },
        },
      },
      { new: true }
    )
      .select("comments")
      .lean<{
        comments: Array<{
          _id: Types.ObjectId;
          content: string;
          createdAt: Date;
        }>;
      }>();

    const created = updated?.comments.at(-1);
    if (!created) {
      return { success: false, error: "Erro ao publicar comentário." };
    }

    revalidatePath("/", "layout");

    await recordChangeHistory({
      workspaceId: auth.ctx.workspaceId,
      targetType: "TASK",
      targetId: auth.ctx.taskId,
      parentId: auth.ctx.projectId,
      actorId: session.user.id,
      action: "COMMENTED",
      summary: `comentou na tarefa ${auth.ctx.taskCode}`,
      details: { commentId: created._id.toString() },
    });

    return {
      success: true,
      data: {
        id: created._id.toString(),
        content: created.content,
        createdAt: new Date(created.createdAt).toISOString(),
      },
    };
  } catch (error) {
    console.error("[createCommentAction]:", error);
    return { success: false, error: "Erro interno ao publicar comentário." };
  }
}

export async function deleteCommentAction(
  input: DeleteCommentInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Sessão expirada." };
    }

    const parsed = deleteCommentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Dados inválidos." };
    }

    const auth = await resolveTaskPermission(parsed.data.taskId, session.user.id);
    if (!auth.ok) return { success: false, error: auth.error };

    // MEMBER só pode apagar o próprio comentário; OWNER/ADMIN podem moderar qualquer um
    const pullFilter =
      auth.ctx.role === "MEMBER"
        ? { _id: parsed.data.commentId, authorId: session.user.id }
        : { _id: parsed.data.commentId };

    const result = await Task.updateOne(
      { _id: auth.ctx.taskId },
      { $pull: { comments: pullFilter } }
    );

    if (result.modifiedCount === 0) {
      return {
        success: false,
        error: "Comentário não encontrado ou sem permissão para excluí-lo.",
      };
    }

    revalidatePath("/", "layout");

    await recordChangeHistory({
      workspaceId: auth.ctx.workspaceId,
      targetType: "TASK",
      targetId: auth.ctx.taskId,
      parentId: auth.ctx.projectId,
      actorId: session.user.id,
      action: "UPDATED",
      summary: `removeu um comentário de ${auth.ctx.taskCode}`,
      details: { commentId: parsed.data.commentId },
    });

    

    return { success: true, data: { id: parsed.data.commentId } };
  } catch (error) {
    console.error("[deleteCommentAction]:", error);
    return { success: false, error: "Erro interno ao excluir comentário." };
  }
}