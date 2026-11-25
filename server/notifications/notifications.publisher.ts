import { emitToWorkspace } from "./notifications.bus";
import type { PublishNotificationInput } from "./notifications.types";

export function notifyWorkspace(input: PublishNotificationInput): void {
  emitToWorkspace(input.workspaceId, {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
}