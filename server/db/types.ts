import { WorkspaceRole } from "./models";


export interface WorkspaceSummaryDTO {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  memberCount: number;
  createdAt: string;
}

