import { getServerSession } from "next-auth";
import type { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import { Workspace } from "@/server/db/models";
import { createNotificationStream } from "@/server/notifications";


export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  await dbConnect();

  const workspaces = await Workspace.find({
    "members.userId": session.user.id,
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId }[]>();

  const stream = createNotificationStream({
    userId: session.user.id,
    workspaceIds: workspaces.map((w) => w._id.toString()),
    signal: request.signal,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}