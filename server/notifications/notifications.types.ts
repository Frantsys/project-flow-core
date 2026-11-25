export type NotificationEntityType = "PROJECT" | "SPRINT" | "TASK";

export type NotificationActionType =
  | "CREATED"
  | "UPDATED"
  | "DELETED"
  | "STATUS_CHANGED"
  | "ASSIGNED"
  | "COMMENTED";

export interface RealtimeNotification {
  id: string;
  workspaceId: string;
  entityType: NotificationEntityType;
  entityId: string;
  action: NotificationActionType;
  message: string;
  actor: {
    id: string;
    name: string;
  };
  createdAt: string;
}

export interface PublishNotificationInput {
  workspaceId: string;
  entityType: NotificationEntityType;
  entityId: string;
  action: NotificationActionType;
  message: string;
  actor: {
    id: string;
    name: string;
  };
}