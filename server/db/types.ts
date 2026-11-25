import type { StatusCategory, WorkspaceRole } from "./models";

export type { StatusCategory };

export interface StatusDTO {
  id: string;
  name: string;
  category: StatusCategory;
}

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
  statuses: StatusDTO[];
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
  statusId: string; // coluna do quadro: id de um item de project.statuses
  rank: string; // posição na coluna
  priority: TaskPriority;
  storyPoints: number | null;
  dueDate: string | null;
  sprint: {
    id: string;
    name: string;
  } | null; // pode não ter sprint associada
  assignee: {
    id: string;
    name: string;
    image: string | null;
  } | null; // a tarefa pode não ter responsável
}

export interface ProjectSprintSummaryDTO {
  id: string;
  name: string;
  goal: string;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
}

export interface ProjectDetailsDTO {
  id: string;
  name: string;
  key: string;
  description: string | null;
  statuses: StatusDTO[];
  workspaceId: string;
  tasks: TaskDTO[];
  sprints: ProjectSprintSummaryDTO[];
}

export interface PersonDTO {
  id: string;
  name: string;
  image: string | null;
}

export interface SubtaskDTO {
  id: string;
  title: string;
  isCompleted: boolean;
  generatedByAi: boolean;
}

export interface CommentDTO {
  id: string;
  content: string;
  createdAt: string;
  author: PersonDTO | null; // autor pode ter sido removido
}

export interface HistoryEntryDTO {
  id: string;
  action: "CREATE" | "MODIFY" | "DELETE";
  targetType: "PROJECT" | "SPRINT" | "TASK" | "SUBTASK" | "COMMENT" | "DOCUMENT";
  actorRole: "OWNER" | "ADMIN" | "MEMBER";
  user: PersonDTO | null;
  details: {
    targetTitle?: string;
    field?: string;
    oldValue?: string | null;
    newValue?: string | null;
  };
  createdAt: string;
}

export interface TaskDetailDTO extends TaskDTO {
  description: string;
  tags: string[];
  aiSummary: string | null;
  reporter: PersonDTO | null;
  subtasks: SubtaskDTO[];
  comments: CommentDTO[];
  history: HistoryEntryDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSummaryDTO {
  id: string;
  title: string;
  parentId: string | null;
  projectId: string | null;
  updatedAt: string;
}

export interface DocumentDTO extends DocumentSummaryDTO {
  content: string;
  author: PersonDTO | null;
}
