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
export async function getSessionUser(): Promise<{ id: string; demo: boolean } | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ? { id: session.user.id, demo: !!session.user.demo } : null;
}

// leituras que a demonstração pode fazer; todo o resto altera dados e fica bloqueado
const DEMO_ALLOWED = new Set(["search", "notification.unreadCount", "notification.recent", "myWork.list"]);
const DEMO_READ_ONLY = "Esta é uma demonstração só para leitura. Crie uma conta grátis para editar.";

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
      const user = await getSessionUser();
      const userId = user?.id ?? null;
      if (!userId && !isPublic) return { success: false, error: SESSION_EXPIRED };
      if (user?.demo && !DEMO_ALLOWED.has(name)) return { success: false, error: DEMO_READ_ONLY };

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
