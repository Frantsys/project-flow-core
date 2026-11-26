"use server";

import { z } from "zod";
import { askBuddy } from "../lib/ai";
import { createAction, fail } from "../lib/action";
import { enforceRateLimit } from "../lib/rate-limit";
import { buildBuddyContext } from "../services/buddy.service";

/** Por pessoa e por dia: uma conversa gasta muitas chamadas, então não divide o limite das tarefas. */
const BUDDY_DAILY_LIMIT = 100;

const buddySchema = z.object({
  pathname: z.string().max(300),
  // só as últimas mensagens vão para a IA: a conversa não cresce sem limite
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(20)
    .refine((m) => m.at(-1)?.role === "user", "A última mensagem deve ser sua."),
});

/** Assistente que acompanha a pessoa: responde sobre a tela em que ela está, sem alterar nada. */
export const askBuddyAction = createAction({
  name: "buddy.ask",
  schema: buddySchema,
  handler: async ({ pathname, messages }, { userId }) => {
    const context = await buildBuddyContext(pathname, userId);
    if (!context) fail("Abra um workspace para conversar com o assistente.");
    await enforceRateLimit(`ai-buddy:${userId}`, BUDDY_DAILY_LIMIT, 24 * 3_600_000);
    return { reply: await askBuddy(context, messages) };
  },
});
