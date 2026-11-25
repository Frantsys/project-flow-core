"use server";

import { z } from "zod";
import { createAction } from "../lib/action";
import { searchEverything } from "../services/search.service";

export const searchAction = createAction({
  name: "search",
  schema: z.object({ q: z.string().max(100) }),
  handler: async ({ q }, { userId }) => searchEverything(userId, q),
});
