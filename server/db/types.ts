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


export interface ProjectDTO {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string | null;
  statuses: string[];
  taskSequence: number;
  createdAt: string;
  updatedAt: string;
}


export type TaskType = "TASK" | "BUG" | "STORY" | "EPIC";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type SprintStatus = "PLANNED" | "ACTIVE" | "COMPLETED";

export interface TaskDTO {
  id: string;
  code: string; 
  title: string;
  type: TaskType;
  status: string; // será usado no frontend para distribuir as colunas de tarefas, estilo kanban
  priority: TaskPriority;
  storyPoints: number | null;
  dueDate: string | null;
  sprint: {
    name: string;
  } | null; // pode não ter sprint associada
  assignee: {
    image: string | null;
  } | null; // o usuário associado pode não ter uma imagem de perfil
}

export interface ProjectSprintSummaryDTO {
  name: string;
  status: SprintStatus;
}

export interface ProjectDetailsDTO {
  id: string;
  name: string;
  key: string;
  description: string | null;
  statuses: string[];
  tasks: TaskDTO[];
  sprints: ProjectSprintSummaryDTO[];
}
