import { z } from "zod";


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

// O model Task aceita só estes tipos (EPIC ainda não existe no schema do Mongo)
export const taskTypeSchema = z.enum(["TASK", "BUG", "STORY"]);
export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export const createTaskSchema = z.object({
  projectId: z
    .string()
    .regex(objectIdRegex, "ID de projeto inválido."),
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
  taskId: z
    .string()
    .regex(objectIdRegex, "ID de tarefa inválido."),
  status: z
    .string()
    .trim()
    .min(1, "Informe o status.")
    .max(50),
});

export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
