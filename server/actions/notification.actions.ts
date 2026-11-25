"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import dbConnect from "@/lib/db";
import { Notification } from "../db/models";
import { createAction } from "../lib/action";
import { countUnread } from "../services/notification.service";

/** Contador do sino; o cliente consulta ao abrir a aba e de tempos em tempos. */
export const getUnreadCountAction = createAction({
  name: "notification.unreadCount",
  schema: z.object({}),
  handler: async (_input, { userId }) => countUnread(userId),
});

/** Marca como lidas as notificações dadas, ou todas se `ids` vier vazio. Só as da própria pessoa. */
export const markNotificationsReadAction = createAction({
  name: "notification.markRead",
  schema: z.object({
    ids: z
      .array(z.string().regex(/^[0-9a-fA-F]{24}$/))
      .max(100)
      .default([]),
  }),
  handler: async ({ ids }, { userId }) => {
    await dbConnect();
    const filter = ids.length ? { userId, _id: { $in: ids }, readAt: null } : { userId, readAt: null };
    const result = await Notification.updateMany(filter, { $set: { readAt: new Date() } });
    revalidatePath("/inbox");
    return { updated: result.modifiedCount };
  },
});
