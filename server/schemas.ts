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


