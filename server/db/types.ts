import { WorkspaceRole } from "./models";


export interface WorkspaceSummaryDTO {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  memberCount: number;
  createdAt: string;
}

export interface WorkspaceMemberDTO {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceProjectSummaryDTO {
  id: string;
  name: string;
  key: string;
}

export interface WorkspaceDTO {
  id: string;
  name: string;
  slug: string;
  currentUserRole: WorkspaceRole;
  owner: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  stats: {
    membersCount: number;
    projectsCount: number;
  };
  members: WorkspaceMemberDTO[];
  projects: WorkspaceProjectSummaryDTO[];
  createdAt: string;
  updatedAt: string;
}



