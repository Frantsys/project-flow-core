import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { SprintStatus, TaskPriority, TaskType } from "./types";

/**
 *  Uso de Schema e Model mongoose para mapear entidades definidas no arquivo de modelo-er
 *  mais detalhes dessa decisão arquitetural em `docs/adrs/003-uso-de-schemas-mongodb.md`
 */

export interface IUser extends Document {
  username: string;
  email: string;
  emailVerified?: Date | null;
  image?: string | null;
  passwordHash?: string | null;
  /** Recebe por e-mail as notificações de atribuição e menção. */
  notifyByEmail: boolean;
  /** Sobe para encerrar todas as sessões abertas (troca de senha, "sair de todos os dispositivos"). */
  sessionVersion: number;
  /** Verificação em duas etapas (só para login com e-mail e senha). */
  twoFactorEnabled: boolean;
  /** Segredo TOTP criptografado (server/lib/totp.ts); o pendente é o da configuração em andamento. */
  twoFactorSecret?: string | null;
  twoFactorPendingSecret?: string | null;
  /** Último passo de tempo aceito: impede reutilizar o mesmo código. */
  twoFactorLastStep: number;
  /** Hashes dos códigos de recuperação ainda não usados. */
  recoveryCodes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    emailVerified: { type: Date, default: null },
    image: { type: String, default: null },

    passwordHash: { type: String, select: false },
    notifyByEmail: { type: Boolean, default: true },
    sessionVersion: { type: Number, default: 0 },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null, select: false },
    twoFactorPendingSecret: { type: String, default: null, select: false },
    twoFactorLastStep: { type: Number, default: 0, select: false },
    recoveryCodes: { type: [String], default: [], select: false },
  },
  { timestamps: true }
);

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

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

/** Categoria define o comportamento: DONE conta como concluída (sprints, relatórios). */
export type StatusCategory = "TODO" | "IN_PROGRESS" | "DONE";

export interface IProjectStatus {
  _id: Types.ObjectId;
  name: string;
  category: StatusCategory;
  /** Nome de uma cor de lib/status-colors.ts; null = a cor do tipo. */
  color?: string | null;
  /** Limite de tarefas na coluna (WIP); null = sem limite. Só avisa, não impede mover. */
  wipLimit?: number | null;
}

export const DEFAULT_STATUSES: { name: string; category: StatusCategory }[] = [
  { name: "A Fazer", category: "TODO" },
  { name: "Em Andamento", category: "IN_PROGRESS" },
  { name: "Revisão", category: "IN_PROGRESS" },
  { name: "Concluído", category: "DONE" },
];

const ProjectStatusSchema = new Schema<IProjectStatus>({
  name: { type: String, required: true, trim: true, maxlength: 40 },
  category: { type: String, enum: ["TODO", "IN_PROGRESS", "DONE"], required: true },
  color: { type: String, default: null },
  wipLimit: { type: Number, default: null, min: 1, max: 999 },
});

export interface IProject extends Document {
  workspaceId: Types.ObjectId;
  key: string;
  name: string;
  description?: string;
  /** Na ordem das colunas do quadro. */
  statuses: Types.DocumentArray<IProjectStatus>;
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
    statuses: { type: [ProjectStatusSchema], default: () => DEFAULT_STATUSES },
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

export interface ITask extends Document {
  projectId: Types.ObjectId;
  sprintId?: Types.ObjectId | null;
  reporterId: Types.ObjectId;
  assigneeId?: Types.ObjectId | null;
  code: string;
  title: string;
  description?: string;
  type: TaskType;
  /** _id de um item de Project.statuses: renomear o status não mexe nas tarefas. */
  statusId: Types.ObjectId;
  /** Posição na coluna (índice fracionário, comparado como texto): ver server/lib/rank.ts. */
  rank: string;
  priority: TaskPriority;
  storyPoints?: number | null;
  tags: string[];
  aiSummary?: string | null;
  dueDate?: Date | null;
  subtasks: ISubtask[];
  createdAt: Date;
  updatedAt: Date;
}

const SubtaskSchema = new Schema<ISubtask>({
  title: { type: String, required: true, trim: true },
  isCompleted: { type: Boolean, default: false },
  generatedByAi: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
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
    statusId: { type: Schema.Types.ObjectId, required: true },
    rank: { type: String, default: "" },
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
  },
  { timestamps: true }
);

TaskSchema.index({ projectId: 1, code: 1 }, { unique: true });
TaskSchema.index({ projectId: 1, statusId: 1, rank: 1 });

export const Task: Model<ITask> = mongoose.models.Task || mongoose.model<ITask>("Task", TaskSchema);

/**
 *  Referente a qualquer tipo de documentação escrita
 *  Feito em Markdown .md
 */
export interface IDocument extends Document {
  workspaceId: Types.ObjectId;
  projectId?: Types.ObjectId | null;
  authorId: Types.ObjectId;
  parentDocId?: Types.ObjectId | null;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    parentDocId: { type: Schema.Types.ObjectId, ref: "Document", default: null },
    title: { type: String, required: true, trim: true, default: "Sem título" },
    content: { type: String, default: "" },
  },
  { timestamps: true }
);

export const DocumentModel: Model<IDocument> =
  mongoose.models.Document || mongoose.model<IDocument>("Document", DocumentSchema);

/**
 *  Entidade referente ao sistema de auditoria e histórico de alterações no contexto de cada Workspace
 */
export type HistoryAction = "CREATE" | "MODIFY" | "DELETE";
export type HistoryTargetType = "PROJECT" | "SPRINT" | "TASK" | "SUBTASK" | "COMMENT" | "DOCUMENT";

export interface IChangeHistory extends Document {
  workspaceId: Types.ObjectId;
  projectId?: Types.ObjectId | null;
  userId: Types.ObjectId;
  actorRole: WorkspaceRole;
  action: HistoryAction;
  targetType: HistoryTargetType;
  targetId: Types.ObjectId;
  parentId?: Types.ObjectId | null;
  details: Record<string, unknown>;
  createdAt: Date;
}

const ChangeHistorySchema = new Schema<IChangeHistory>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorRole: {
      type: String,
      enum: ["OWNER", "ADMIN", "MEMBER"],
      required: true,
    },
    action: {
      type: String,
      enum: ["CREATE", "MODIFY", "DELETE"],
      required: true,
    },
    targetType: {
      type: String,
      enum: ["PROJECT", "SPRINT", "TASK", "SUBTASK", "COMMENT", "DOCUMENT"],
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId, required: true },
    parentId: { type: Schema.Types.ObjectId, default: null },
    details: { type: Schema.Types.Mixed, default: {} },
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
  mongoose.models.ChangeHistory || mongoose.model<IChangeHistory>("ChangeHistory", ChangeHistorySchema);

/** Janela fixa do limite de tentativas: `_id` = ação + identificador + janela; o TTL apaga as vencidas. */
export interface IRateLimit {
  _id: string;
  count: number;
  expiresAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>(
  {
    _id: { type: String, required: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit: Model<IRateLimit> =
  mongoose.models.RateLimit || mongoose.model<IRateLimit>("RateLimit", RateLimitSchema);

export type AuthTokenPurpose = "VERIFY_EMAIL" | "RESET_PASSWORD";

/** Link de uso único enviado por e-mail. Guarda só o hash do token; o TTL apaga os vencidos. */
export interface IAuthToken {
  userId: Types.ObjectId;
  purpose: AuthTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
}

const AuthTokenSchema = new Schema<IAuthToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    purpose: { type: String, enum: ["VERIFY_EMAIL", "RESET_PASSWORD"], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

AuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AuthTokenSchema.index({ userId: 1, purpose: 1 });

export const AuthToken: Model<IAuthToken> =
  mongoose.models.AuthToken || mongoose.model<IAuthToken>("AuthToken", AuthTokenSchema);

/** Convite pendente para um workspace. Um por e-mail por workspace; reenviar troca o token. */
export interface IInvitation {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  email: string;
  role: "ADMIN" | "MEMBER";
  tokenHash: string;
  invitedBy: Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

const InvitationSchema = new Schema<IInvitation>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["ADMIN", "MEMBER"], required: true },
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

InvitationSchema.index({ workspaceId: 1, email: 1 }, { unique: true });
InvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Invitation: Model<IInvitation> =
  mongoose.models.Invitation || mongoose.model<IInvitation>("Invitation", InvitationSchema);

/**
 * Comentário de tarefa. Fica fora do documento da tarefa (que antes crescia sem limite) para
 * poder ser paginado, editado e citado em notificações.
 */
export interface IComment {
  _id: Types.ObjectId;
  taskId: Types.ObjectId;
  projectId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  authorId: Types.ObjectId;
  content: string;
  /** Pessoas mencionadas com @Nome no texto. */
  mentions: Types.ObjectId[];
  editedAt: Date | null;
  createdAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    mentions: { type: [Schema.Types.ObjectId], default: [] },
    editedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

CommentSchema.index({ taskId: 1, createdAt: 1 });

export const Comment: Model<IComment> =
  mongoose.models.Comment || mongoose.model<IComment>("Comment", CommentSchema);

export type NotificationType = "ASSIGNED" | "MENTIONED" | "COMMENTED" | "INVITE_ACCEPTED";

/** Aviso para uma pessoa. Some sozinho depois de 90 dias (índice TTL). */
export interface INotification {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  actorId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  taskId: Types.ObjectId | null;
  /** Alvo como aparece na tela: "PF-12 Corrigir login" ou o nome do workspace. */
  title: string;
  href: string;
  readAt: Date | null;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["ASSIGNED", "MENTIONED", "COMMENTED", "INVITE_ACCEPTED"], required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", default: null, index: true },
    title: { type: String, required: true },
    href: { type: String, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);

/** Token da API pública (/api/v1): dá leitura aos projetos e tarefas de um workspace. Só o hash é guardado. */
export interface IApiToken {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  name: string;
  tokenHash: string;
  /** Começo do token ("pf_ab12…"), para reconhecer na lista sem expor o resto. */
  prefix: string;
  createdBy: Types.ObjectId;
  lastUsedAt: Date | null;
  createdAt: Date;
}

const ApiTokenSchema = new Schema<IApiToken>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    tokenHash: { type: String, required: true, unique: true },
    prefix: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

export const ApiToken: Model<IApiToken> =
  mongoose.models.ApiToken || mongoose.model<IApiToken>("ApiToken", ApiTokenSchema);

export const TRASH_DAYS = 30;

/**
 * Item da lixeira: a tarefa (com os comentários) ou o documento (com a subárvore) inteiros, como
 * estavam ao excluir. Restaurar devolve os documentos originais; o índice TTL apaga de vez em 30 dias.
 * Guardar à parte, em vez de marcar `deletedAt`, deixa todas as outras consultas como estão.
 */
export interface ITrashItem {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  projectId: Types.ObjectId | null;
  kind: "TASK" | "DOCUMENT";
  /** Como aparece na lista: "PF-12 Corrigir login" ou o título do documento. */
  title: string;
  deletedBy: Types.ObjectId;
  /** TASK: [tarefa]; DOCUMENT: o documento excluído primeiro, depois os subdocumentos. */
  items: unknown[];
  comments: unknown[];
  createdAt: Date;
}

const TrashItemSchema = new Schema<ITrashItem>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    kind: { type: String, enum: ["TASK", "DOCUMENT"], required: true },
    title: { type: String, required: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: Array, default: [] },
    comments: { type: Array, default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

TrashItemSchema.index({ workspaceId: 1, createdAt: -1 });
TrashItemSchema.index({ createdAt: 1 }, { expireAfterSeconds: TRASH_DAYS * 24 * 3600 });

export const TrashItem: Model<ITrashItem> =
  mongoose.models.TrashItem || mongoose.model<ITrashItem>("TrashItem", TrashItemSchema);
