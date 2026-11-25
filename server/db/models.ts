import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { ChangeActionType, ChangeTargetType, SprintStatus, TaskPriority, TaskType } from "./types";

/**
 *  Uso de Schema e Model mongoose para mapear entidades definidas no arquivo de modelo-er
 *  mais detalhes dessa decisão arquitetural em `docs/adrs/003-uso-de-schemas-mongodb.md`
 */


export interface IUser extends Document {
    username: string
    email: string
    emailVerified?: Date | null
    image?: string | null
    passwordHash?: string | null
    createdAt: Date
    updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    emailVerified: { type: Date, default: null },
    image: { type: String, default: null },

    passwordHash: { type: String, select: false },
  },
  { timestamps: true }
);


export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);





export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

export interface IWorkspaceMember {
  userId: Types.ObjectId;
  role: WorkspaceRole;
  joinedAt: Date;
}

export interface IWorkspace extends Document {
  name: string;
  slug: string;
  ownerId: Types.ObjectId;
  members: IWorkspaceMember[];
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceMemberSchema = new Schema<IWorkspaceMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["OWNER", "ADMIN", "MEMBER"],
      default: "MEMBER",
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: { type: [WorkspaceMemberSchema], default: [] },
  },
  { timestamps: true }
);

WorkspaceSchema.index({ "members.userId": 1 });

export const Workspace: Model<IWorkspace> =
  mongoose.models.Workspace || mongoose.model<IWorkspace>("Workspace", WorkspaceSchema);



export interface IProject extends Document {
  workspaceId: Types.ObjectId;
  key: string;
  name: string;
  description?: string;
  statuses: string[];
  taskSequence: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    key: { type: String, required: true, uppercase: true, trim: true, maxlength: 10 },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    statuses: {
      type: [String],
      default: ["A Fazer", "Em Andamento", "Revisão", "Concluído"],
    },
    // Contador incremental para gerar códigos únicos como WEB2-1, WEB2-2...
    taskSequence: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ProjectSchema.index({ workspaceId: 1, key: 1 }, { unique: true });

export const Project: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>("Project", ProjectSchema);




export interface ISprint extends Document {
  projectId: Types.ObjectId;
  name: string;
  goal?: string;
  status: SprintStatus;
  startDate?: Date | null;
  endDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SprintSchema = new Schema<ISprint>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    name: { type: String, required: true, trim: true },
    goal: { type: String, default: "" },
    status: {
      type: String,
      enum: ["PLANNED", "ACTIVE", "COMPLETED"],
      default: "PLANNED",
    },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Sprint: Model<ISprint> =
  mongoose.models.Sprint || mongoose.model<ISprint>("Sprint", SprintSchema);

/**
 *  Task Aggregate
 *  Agregado de tarefas, subtarefas(passos) e comentários
 *  A partir dessa região, pode haver influência de IA
 */

/**
 *  Interfaces SubTasks e Comment são entidades children do agregado Task
 *  Por essa razão não extendem de Document
 */

export interface ISubtask {
  _id: Types.ObjectId;
  title: string;
  isCompleted: boolean;
  generatedByAi: boolean;
  order: number;
}

export interface IComment {
  _id: Types.ObjectId;
  authorId: Types.ObjectId;
  content: string;
  createdAt: Date;
}

export interface ITask extends Document {
  projectId: Types.ObjectId;
  sprintId?: Types.ObjectId | null;
  reporterId: Types.ObjectId;
  assigneeId?: Types.ObjectId | null;
  code: string;
  title: string;
  description?: string;
  type: TaskType;
  status: string;
  priority: TaskPriority;
  storyPoints?: number | null;
  tags: string[];
  aiSummary?: string | null;
  dueDate?: Date | null;
  subtasks: ISubtask[];
  comments: IComment[];
  createdAt: Date;
  updatedAt: Date;
}

const SubtaskSchema = new Schema<ISubtask>({
  title: { type: String, required: true, trim: true },
  isCompleted: { type: Boolean, default: false },
  generatedByAi: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
});

const CommentSchema = new Schema<IComment>({
  authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

const TaskSchema = new Schema<ITask>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    sprintId: { type: Schema.Types.ObjectId, ref: "Sprint", default: null, index: true },
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    type: {
      type: String,
      enum: ["TASK", "BUG", "STORY"],
      default: "TASK",
    },
    status: { type: String, required: true, default: "A Fazer" },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
    },
    storyPoints: { type: Number, default: null },
    tags: { type: [String], default: [] },
    aiSummary: { type: String, default: null },
    dueDate: { type: Date, default: null },
    subtasks: { type: [SubtaskSchema], default: [] },
    comments: { type: [CommentSchema], default: [] },
  },
  { timestamps: true }
);

TaskSchema.index({ projectId: 1, code: 1 }, { unique: true });
TaskSchema.index({ projectId: 1, status: 1 });

export const Task: Model<ITask> =
  mongoose.models.Task || mongoose.model<ITask>("Task", TaskSchema);


/**
 *  Entidade referente ao sistema de auditoria e histórico de alterações no contexto de cada Workspace
 */

export interface IChangeHistory extends Document {
  workspaceId: Types.ObjectId;
  projectId?: Types.ObjectId | null;
  actorId: Types.ObjectId;
  actorRole: WorkspaceRole;
  action: ChangeActionType;
  targetType: ChangeTargetType;
  targetId: Types.ObjectId;
  parentId?: Types.ObjectId | null;
  details: Record<string, unknown>;
  summary: string
  createdAt: Date;
}

const ChangeHistorySchema = new Schema<IChangeHistory>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorRole: {
      type: String,
      enum: ["OWNER", "ADMIN", "MEMBER"],
      required: true,
    },
    action: {
      type: String,
      enum: ["CREATE", "MODIFY", "DELETE", "STATUS_CHANGED", "ASSIGNED", "COMMENTED", "MEMBER_ADDED", "MEMBER_REMOVED"],
      required: true,
    },
    targetType: {
      type: String,
      enum: ["WORKSPACE", "PROJECT", "SPRINT", "TASK", "SUBTASK", "COMMENT"],
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId, required: true },
    parentId: { type: Schema.Types.ObjectId, default: null },
    details: { type: Schema.Types.Mixed, default: {} },
    summary: { type: String, required: true }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Índices para alimentar o feed do workspace, feed do projeto e timeline da tarefa
ChangeHistorySchema.index({ workspaceId: 1, createdAt: -1 });
ChangeHistorySchema.index({ projectId: 1, createdAt: -1 });
ChangeHistorySchema.index({ targetId: 1, createdAt: -1 });
ChangeHistorySchema.index({ parentId: 1, createdAt: -1 });

export const ChangeHistory: Model<IChangeHistory> =
  mongoose.models.ChangeHistory ||
  mongoose.model<IChangeHistory>("ChangeHistory", ChangeHistorySchema);


