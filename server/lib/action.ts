import "server-only";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import type { ActionResult } from "@/types";

/**
 * Erro esperado de regra de negócio ("Sprint não encontrada", "Sem permissão").
 * Lançado de qualquer ponto do handler e devolvido ao cliente como { success: false }.
 */
export class ActionError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ActionError";
  }
}

/** Atalho para interromper o handler com uma mensagem para a pessoa. */
export function fail(message: string, fieldErrors?: Record<string, string[]>): never {
  throw new ActionError(message, fieldErrors);
}

/** Único ponto que lê a sessão nas actions (substituído por um mock nos testes). */
export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

interface ActionContext {
  userId: string;
}

interface ActionOptions<S extends z.ZodType, R> {
  /** Nome usado nos logs: "task.update". */
  name: string;
  schema: S;
  /** Ações abertas sem login (ex.: cadastro). */
  public?: boolean;
  handler: (input: z.output<S>, ctx: ActionContext) => Promise<R>;
}

const SESSION_EXPIRED = "Sessão expirada. Faça login novamente.";

/**
 * Cria uma server action com o comportamento padrão do projeto:
 * sessão → validação com zod → handler → resultado em `ActionResult`.
 * Erros inesperados viram uma mensagem genérica e vão para o log com o nome da action.
 */
export function createAction<S extends z.ZodType, R>({
  name,
  schema,
  public: isPublic = false,
  handler,
}: ActionOptions<S, R>) {
  return async (input: z.input<S>): Promise<ActionResult<R>> => {
    try {
      const userId = await getSessionUserId();
      if (!userId && !isPublic) return { success: false, error: SESSION_EXPIRED };

      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        return {
          success: false,
          error: "Dados inválidos.",
          fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
        };
      }

      const data = await handler(parsed.data, { userId: userId ?? "" });
      return { success: true, data };
    } catch (error) {
      if (error instanceof ActionError) {
        return { success: false, error: error.message, fieldErrors: error.fieldErrors };
      }
      console.error(`[action:${name}]`, error);
      return { success: false, error: "Algo deu errado do nosso lado. Tente de novo em instantes." };
    }
  };
}
