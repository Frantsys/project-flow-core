import { z } from "zod";
import { SprintStatus, TaskPriority, TaskType } from "./db/types";


export const signUpSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(2, "O nome deve ter pelo menos 2 caracteres.")
      .max(60, "O nome deve ter no máximo 60 caracteres."),

    email: z
      .email("Informe um e-mail válido.")
      .trim()
      .toLowerCase(),
    password: z
      .string()
      .min(8, "A senha deve ter no mínimo 8 caracteres.")
      .max(72, "A senha deve ter no máximo 72 caracteres."),
    
    confirmPassword: z
      .string()
      .min(1, "Confirme a sua senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });



export const loginSchema = z.object({
  email: z
    .email("Informe um e-mail válido.")
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(1, "Informe a sua senha."),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;



export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "O nome do workspace deve ter pelo menos 3 caracteres.")
    .max(50, "O nome deve ter no máximo 50 caracteres."),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;


const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const updateWorkspaceSchema = z.object({
  workspaceId: z.string()
    .nonempty()
    .regex(objectIdRegex, "ID de workspace inválido."),
  name: z.string()
    .trim()
    .min(3, "O nome do workspace deve ter pelo menos 3 caracteres.")
    .max(50, "O nome deve ter no máximo 50 caracteres."),
});

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const deleteWorkspaceSchema = z.object({
    workspaceId: z.string()
        .nonempty()
        .regex(objectIdRegex, "ID inválido.")
});

export type DeleteWorkspaceInput = z.infer<typeof deleteWorkspaceSchema>;


export const createProjectSchema = z.object({
  workspaceId: z
    .string()
    .regex(objectIdRegex, "ID de workspace inválido."),
  name: z
    .string()
    .trim()
    .min(2, "O nome do projeto deve ter pelo menos 2 caracteres.")
    .max(60, "O nome deve ter no máximo 60 caracteres."),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z][A-Z0-9]{1,9}$/,
      "A chave deve começar com letra e ter entre 2 e 10 caracteres alfanuméricos."
    ),
  description: z
    .string()
    .trim()
    .max(500, "A descrição deve ter no máximo 500 caracteres.")
    .optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;



export const updateProjectSchema = z
  .object({
    projectId: z
      .string()
      .regex(objectIdRegex, "ID de projeto inválido."),
    name: z
      .string()
      .trim()
      .min(2, "O nome do projeto deve ter pelo menos 2 caracteres.")
      .max(60, "O nome deve ter no máximo 60 caracteres.")
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, "A descrição deve ter no máximo 500 caracteres.")
      .nullable()
      .optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.description !== undefined,
    {
      message: "Informe ao menos o nome ou a descrição para atualizar.",
    }
  );

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;


export const deleteProjectSchema = z.object({
  projectId: z
    .string()
    .regex(objectIdRegex, "ID de projeto inválido."),
});

export type DeleteProjectInput = z.infer<typeof deleteProjectSchema>;



// para uso em enums nos schemas
const TASK_TYPES = [
  "TASK",
  "BUG",
  "STORY",
  "EPIC",
] as const satisfies readonly TaskType[];

const TASK_PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
] as const satisfies readonly TaskPriority[];

export const createTaskSchema = z.object({
  projectId: z
    .string()
    .regex(objectIdRegex, "ID de projeto inválido."),
  title: z
    .string()
    .trim()
    .min(2, "O título da tarefa deve ter pelo menos 2 caracteres.")
    .max(120, "O título deve ter no máximo 120 caracteres."),
  description: z
    .string()
    .trim()
    .max(5000, "A descrição deve ter no máximo 5000 caracteres.")
    .nullable()
    .optional(),
  type: z.enum(TASK_TYPES).default("TASK"),
  status: z.string().trim().min(1).optional(),
  priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
  storyPoints: z
    .number()
    .int("Story points deve ser um número inteiro.")
    .min(0, "Story points não pode ser negativo.")
    .max(100, "Story points deve ser no máximo 100.")
    .nullable()
    .optional(),
  dueDate: z.coerce.date().nullable().optional(),
  sprintId: z
    .string()
    .regex(objectIdRegex, "ID de sprint inválido.")
    .nullable()
    .optional(),
  assigneeId: z
    .string()
    .regex(objectIdRegex, "ID de responsável inválido.")
    .nullable()
    .optional(),
});

export type CreateTaskInput = z.input<typeof createTaskSchema>;




export const updateTaskSchema = z
  .object({
    taskId: z
      .string()
      .regex(objectIdRegex, "ID de tarefa inválido."),
    title: z
      .string()
      .trim()
      .min(2, "O título da tarefa deve ter pelo menos 2 caracteres.")
      .max(120, "O título deve ter no máximo 120 caracteres.")
      .optional(),
    description: z
      .string()
      .trim()
      .max(5000, "A descrição deve ter no máximo 5000 caracteres.")
      .nullable()
      .optional(),
    type: z.enum(TASK_TYPES).optional(),
    status: z
      .string()
      .trim()
      .min(1, "Status inválido.")
      .optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    storyPoints: z
      .number()
      .int("Story points deve ser um número inteiro.")
      .min(0, "Story points não pode ser negativo.")
      .max(100, "Story points deve ser no máximo 100.")
      .nullable()
      .optional(),
    dueDate: z.union([z.null(), z.coerce.date()]).optional(),
    sprintId: z
      .string()
      .regex(objectIdRegex, "ID de sprint inválido.")
      .nullable()
      .optional(),
    assigneeId: z
      .string()
      .regex(objectIdRegex, "ID de responsável inválido.")
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      const { taskId: _, ...updatableFields } = data;
      return Object.values(updatableFields).some((value) => value !== undefined);
    },
    {
      message: "Informe ao menos um campo para atualizar a tarefa.",
    }
  );

export type UpdateTaskInput = z.input<typeof updateTaskSchema>;


export const deleteTaskSchema = z.object({
  taskId: z
    .string()
    .regex(objectIdRegex, "ID de tarefa inválido."),
});

export type DeleteTaskInput = z.infer<typeof deleteTaskSchema>;




export const createSubtaskSchema = z.object({
  taskId: z.string().regex(objectIdRegex, "ID de tarefa inválido."),
  title: z
    .string()
    .trim()
    .min(1, "O título da subtarefa é obrigatório.")
    .max(200, "O título deve ter no máximo 200 caracteres."),
  generatedByAi: z.boolean().default(false),
});

export const toggleSubtaskSchema = z.object({
  taskId: z.string().regex(objectIdRegex, "ID de tarefa inválido."),
  subtaskId: z.string().regex(objectIdRegex, "ID de subtarefa inválido."),
  isCompleted: z.boolean(),
});

export const deleteSubtaskSchema = z.object({
  taskId: z.string().regex(objectIdRegex, "ID de tarefa inválido."),
  subtaskId: z.string().regex(objectIdRegex, "ID de subtarefa inválido."),
});

export const createCommentSchema = z.object({
  taskId: z.string().regex(objectIdRegex, "ID de tarefa inválido."),
  content: z
    .string()
    .trim()
    .min(1, "O comentário não pode estar vazio.")
    .max(2000, "O comentário deve ter no máximo 2000 caracteres."),
});

export const deleteCommentSchema = z.object({
  taskId: z.string().regex(objectIdRegex, "ID de tarefa inválido."),
  commentId: z.string().regex(objectIdRegex, "ID de comentário inválido."),
});

export type CreateSubtaskInput = z.input<typeof createSubtaskSchema>;
export type ToggleSubtaskInput = z.infer<typeof toggleSubtaskSchema>;
export type DeleteSubtaskInput = z.infer<typeof deleteSubtaskSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type DeleteCommentInput = z.infer<typeof deleteCommentSchema>;



const SPRINT_STATUSES = [
  "PLANNED",
  "ACTIVE",
  "COMPLETED",
] as const satisfies readonly SprintStatus[];

const nullableDateSchema = z.union([z.null(), z.coerce.date()]).optional();

export const createSprintSchema = z
  .object({
    projectId: z.string().regex(objectIdRegex, "ID de projeto inválido."),
    name: z
      .string()
      .trim()
      .min(2, "O nome da sprint deve ter pelo menos 2 caracteres.")
      .max(80, "O nome deve ter no máximo 80 caracteres."),
    goal: z
      .string()
      .trim()
      .max(500, "A meta deve ter no máximo 500 caracteres.")
      .nullable()
      .optional(),
    startDate: nullableDateSchema,
    endDate: nullableDateSchema,
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: "A data de término deve ser igual ou posterior à data de início.",
      path: ["endDate"],
    }
  );

export const updateSprintSchema = z
  .object({
    sprintId: z.string().regex(objectIdRegex, "ID de sprint inválido."),
    name: z
      .string()
      .trim()
      .min(2, "O nome da sprint deve ter pelo menos 2 caracteres.")
      .max(80, "O nome deve ter no máximo 80 caracteres.")
      .optional(),
    goal: z
      .string()
      .trim()
      .max(500, "A meta deve ter no máximo 500 caracteres.")
      .nullable()
      .optional(),
    status: z.enum(SPRINT_STATUSES).optional(),
    startDate: nullableDateSchema,
    endDate: nullableDateSchema,
  })
  .refine(
    (data) => {
      const { sprintId: _, ...fields } = data;
      return Object.values(fields).some((v) => v !== undefined);
    },
    { message: "Informe ao menos um campo para atualizar a sprint." }
  )
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: "A data de término deve ser igual ou posterior à data de início.",
      path: ["endDate"],
    }
  );

export const deleteSprintSchema = z.object({
  sprintId: z.string().regex(objectIdRegex, "ID de sprint inválido."),
});

export type CreateSprintInput = z.input<typeof createSprintSchema>;
export type UpdateSprintInput = z.input<typeof updateSprintSchema>;
export type DeleteSprintInput = z.infer<typeof deleteSprintSchema>;