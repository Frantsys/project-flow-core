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


export interface TaskDetailsDTO {
  id: string
  code: string
  title: string
  description?: string | null
  type: TaskType
  status: string
  priority: TaskPriority
  storyPoints: string
  tags: string[]
  aiSummary?: string | null
  dueDate?: Date | string | null
  createdAt: Date | string

  // o que quero das relações
  sprint?: {
    name: string
  } | null

  reporter: {
    id: string
    username: string
    image?: string | null
  }

  assignee?: {
    id: string
    username: string
    image?: string | null
  } | null

  subtasks: {
    id: string
    title: string
    isCompleted: boolean
    generatedByAi: boolean
    order: number
  }[]

  comments: {
    id: string
    content: string
    author: {
      id: string
      username: string
      image?: string | null
    }
    createdAt: Date | string
  }[]


}



export interface SprintTaskDTO {
  id: string;
  code: string;
  title: string;
  type: TaskType;
  status: string;
  priority: TaskPriority;
  storyPoints: number | null;
  dueDate: string | null;
  assignee: {
    id: string;
    name: string;
    image: string | null;
  } | null;
}

export interface SprintWithTasksDTO {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
  tasksCount: number;
  tasks: SprintTaskDTO[];
  createdAt: string;
}



export type ChangeTargetType =
  | "WORKSPACE"
  | "PROJECT"
  | "SPRINT"
  | "TASK";

export type ChangeActionType =
  | "CREATED"
  | "UPDATED"
  | "DELETED"
  | "STATUS_CHANGED"
  | "ASSIGNED"
  | "COMMENTED"
  | "MEMBER_ADDED"
  | "MEMBER_REMOVED";

export interface ChangeHistoryDTO {
  id: string;
  workspaceId: string;
  targetType: ChangeTargetType;
  targetId: string;
  parentId: string | null;
  action: ChangeActionType;
  summary: string
  details?: Record<string, unknown> | null;
  actor: {
    id: string;
    name: string;
    image: string | null;
  };
  createdAt: string;
}




