import { z } from "zod";

export const signUpSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(2, "O nome deve ter pelo menos 2 caracteres.")
      .max(60, "O nome deve ter no máximo 60 caracteres."),

    email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
    password: z
      .string()
      .min(8, "A senha deve ter no mínimo 8 caracteres.")
      .max(72, "A senha deve ter no máximo 72 caracteres."),

    confirmPassword: z.string().min(1, "Confirme a sua senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
  password: z.string().min(1, "Informe a sua senha."),
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
  workspaceId: z.string().nonempty().regex(objectIdRegex, "ID de workspace inválido."),
  name: z
    .string()
    .trim()
    .min(3, "O nome do workspace deve ter pelo menos 3 caracteres.")
    .max(50, "O nome deve ter no máximo 50 caracteres."),
});

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const deleteWorkspaceSchema = z.object({
  workspaceId: z.string().nonempty().regex(objectIdRegex, "ID inválido."),
});

export type DeleteWorkspaceInput = z.infer<typeof deleteWorkspaceSchema>;

export const createProjectSchema = z.object({
  workspaceId: z.string().regex(objectIdRegex, "ID de workspace inválido."),
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
  description: z.string().trim().max(500, "A descrição deve ter no máximo 500 caracteres.").optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    projectId: z.string().regex(objectIdRegex, "ID de projeto inválido."),
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
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: "Informe ao menos o nome ou a descrição para atualizar.",
  });

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const deleteProjectSchema = z.object({
  projectId: z.string().regex(objectIdRegex, "ID de projeto inválido."),
});

export type DeleteProjectInput = z.infer<typeof deleteProjectSchema>;

// O model Task aceita só estes tipos (EPIC ainda não existe no schema do Mongo)
export const taskTypeSchema = z.enum(["TASK", "BUG", "STORY"]);
export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export const createTaskSchema = z.object({
  projectId: z.string().regex(objectIdRegex, "ID de projeto inválido."),
  title: z
    .string()
    .trim()
    .min(2, "O título deve ter pelo menos 2 caracteres.")
    .max(200, "O título deve ter no máximo 200 caracteres."),
  type: taskTypeSchema.default("TASK"),
  priority: taskPrioritySchema.default("MEDIUM"),
  // vazio = primeiro status do projeto
  status: z.string().trim().max(50).optional(),
  storyPoints: z
    .number("Informe um número.")
    .int("Use um número inteiro.")
    .min(0, "Os pontos não podem ser negativos.")
    .max(100, "Use no máximo 100 pontos.")
    .nullable()
    .optional(),
  // "AAAA-MM-DD" vindo de <input type="date">
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
    .nullable()
    .optional(),
});

export type CreateTaskInput = z.input<typeof createTaskSchema>;

export const updateTaskStatusSchema = z.object({
  taskId: z.string().regex(objectIdRegex, "ID de tarefa inválido."),
  status: z.string().trim().min(1, "Informe o status.").max(50),
});

export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;

const nullableObjectId = z.string().regex(objectIdRegex, "ID inválido.").nullable();

export const updateTaskSchema = z.object({
  taskId: z.string().regex(objectIdRegex, "ID de tarefa inválido."),
  title: z
    .string()
    .trim()
    .min(2, "O título deve ter pelo menos 2 caracteres.")
    .max(200, "O título deve ter no máximo 200 caracteres.")
    .optional(),
  description: z.string().max(20000, "A descrição deve ter no máximo 20.000 caracteres.").optional(),
  type: taskTypeSchema.optional(),
  priority: taskPrioritySchema.optional(),
  status: z.string().trim().min(1).max(50).optional(),
  storyPoints: z
    .number("Informe um número.")
    .int("Use um número inteiro.")
    .min(0, "Os pontos não podem ser negativos.")
    .max(100, "Use no máximo 100 pontos.")
    .nullable()
    .optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
    .nullable()
    .optional(),
  assigneeId: nullableObjectId.optional(),
  sprintId: nullableObjectId.optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const taskIdSchema = z.object({
  taskId: z.string().regex(objectIdRegex, "ID de tarefa inválido."),
});

export const addSubtaskSchema = taskIdSchema.extend({
  title: z
    .string()
    .trim()
    .min(1, "Escreva a subtarefa.")
    .max(200, "A subtarefa deve ter no máximo 200 caracteres."),
});

export const subtaskRefSchema = taskIdSchema.extend({
  subtaskId: z.string().regex(objectIdRegex, "ID de subtarefa inválido."),
});

export const addCommentSchema = taskIdSchema.extend({
  content: z
    .string()
    .trim()
    .min(1, "Escreva o comentário.")
    .max(5000, "O comentário deve ter no máximo 5.000 caracteres."),
});

export const commentRefSchema = taskIdSchema.extend({
  commentId: z.string().regex(objectIdRegex, "ID de comentário inválido."),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

export const createSprintSchema = z
  .object({
    projectId: z.string().regex(objectIdRegex, "ID de projeto inválido."),
    name: z
      .string()
      .trim()
      .min(2, "O nome deve ter pelo menos 2 caracteres.")
      .max(60, "O nome deve ter no máximo 60 caracteres."),
    goal: z.string().trim().max(300, "A meta deve ter no máximo 300 caracteres.").optional(),
    startDate: isoDate.nullable().optional(),
    endDate: isoDate.nullable().optional(),
  })
  .refine((d) => !d.startDate || !d.endDate || d.startDate <= d.endDate, {
    message: "A data de fim deve ser depois do início.",
    path: ["endDate"],
  });

export type CreateSprintInput = z.infer<typeof createSprintSchema>;

export const sprintIdSchema = z.object({
  sprintId: z.string().regex(objectIdRegex, "ID de sprint inválido."),
});

export const completeSprintSchema = sprintIdSchema.extend({
  // null = tarefas abertas voltam para o backlog
  moveToSprintId: z.string().regex(objectIdRegex, "ID de sprint inválido.").nullable(),
});

export const addMemberSchema = z.object({
  workspaceId: z.string().regex(objectIdRegex, "ID de workspace inválido."),
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
  role: z.enum(["ADMIN", "MEMBER"]),
});

export const memberRefSchema = z.object({
  workspaceId: z.string().regex(objectIdRegex, "ID de workspace inválido."),
  userId: z.string().regex(objectIdRegex, "ID de usuário inválido."),
});

export const updateMemberRoleSchema = memberRefSchema.extend({
  role: z.enum(["ADMIN", "MEMBER"]),
});

export const createDocumentSchema = z.object({
  workspaceId: z.string().regex(objectIdRegex, "ID de workspace inválido."),
  parentId: z.string().regex(objectIdRegex, "ID inválido.").nullable().optional(),
  projectId: z.string().regex(objectIdRegex, "ID inválido.").nullable().optional(),
  title: z.string().trim().max(150).optional(),
});

export const updateDocumentSchema = z.object({
  documentId: z.string().regex(objectIdRegex, "ID de documento inválido."),
  title: z
    .string()
    .trim()
    .min(1, "Dê um título ao documento.")
    .max(150, "O título deve ter no máximo 150 caracteres."),
  content: z.string().max(200000, "O documento passou do tamanho máximo."),
});

export const documentIdSchema = z.object({
  documentId: z.string().regex(objectIdRegex, "ID de documento inválido."),
});
