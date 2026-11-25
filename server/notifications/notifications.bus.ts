import { EventEmitter } from "events";
import type { RealtimeNotification } from "./notifications.types";

const globalForBus = globalThis as unknown as {
  __notificationBus?: EventEmitter;
};

const bus = globalForBus.__notificationBus ?? new EventEmitter();
bus.setMaxListeners(200);

if (process.env.NODE_ENV !== "production") {
  globalForBus.__notificationBus = bus;
}

export function emitToWorkspace(
  workspaceId: string,
  payload: RealtimeNotification
): void {
  bus.emit(`ws:${workspaceId}`, payload);
}

export function subscribeToWorkspaces(
  workspaceIds: string[],
  listener: (payload: RealtimeNotification) => void
): () => void {
  const channels = workspaceIds.map((id) => `ws:${id}`);

  for (const channel of channels) {
    bus.on(channel, listener);
  }

  return () => {
    for (const channel of channels) {
      bus.off(channel, listener);
    }
  };
}