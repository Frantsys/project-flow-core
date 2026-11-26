import "server-only";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import type { SavedViewDTO } from "@/lib/saved-views";
import { SavedView } from "../db/models";

/** Visões salvas da pessoa neste projeto, na ordem em que foram criadas. */
export async function getSavedViews(projectId: string, userId: string): Promise<SavedViewDTO[]> {
  if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(userId)) return [];
  await dbConnect();
  const views = await SavedView.find({ projectId, userId }).sort({ createdAt: 1 }).lean();
  return views.map((v) => ({ id: v._id.toString(), name: v.name, query: v.query }));
}
