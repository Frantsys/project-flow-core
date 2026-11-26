"use server";

import { z } from "zod";
import { todayInBrazil } from "@/lib/labels";
import { createAction } from "../lib/action";
import { getMyOpenTasks } from "../services/my-work.service";

/** Tarefas abertas da pessoa para o painel flutuante; o dia de hoje vem junto para agrupar pelo prazo. */
export const getMyWorkAction = createAction({
  name: "myWork.list",
  schema: z.object({}),
  handler: async (_input, { userId }) => ({ tasks: await getMyOpenTasks(userId), today: todayInBrazil() }),
});
