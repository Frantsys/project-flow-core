import "server-only";
import dbConnect from "@/lib/db";
import { DocumentModel, Invitation, Project, Task, Workspace } from "../db/models";

export interface OnboardingStep {
  id: "project" | "task" | "invite" | "doc";
  done: boolean;
}

/** O que já foi feito no workspace, para o checklist de primeiros passos da visão geral. */
export async function getOnboarding(workspaceId: string): Promise<OnboardingStep[]> {
  await dbConnect();
  const projectIds = (await Project.find({ workspaceId }).select("_id").lean()).map((p) => p._id);
  const [task, members, invite, doc] = await Promise.all([
    projectIds.length ? Task.exists({ projectId: { $in: projectIds } }) : null,
    Workspace.findById(workspaceId).select("members.userId").lean(),
    Invitation.exists({ workspaceId }),
    DocumentModel.exists({ workspaceId }),
  ]);
  return [
    { id: "project", done: projectIds.length > 0 },
    { id: "task", done: !!task },
    { id: "invite", done: (members?.members.length ?? 0) > 1 || !!invite },
    { id: "doc", done: !!doc },
  ];
}
