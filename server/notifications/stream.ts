import { subscribeToWorkspaces } from "./notifications.bus";

interface CreateStreamOptions {
  userId: string;
  workspaceIds: string[];
  signal: AbortSignal;
}

export function createNotificationStream({
  userId,
  workspaceIds,
  signal,
}: CreateStreamOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let isClosed = false;
  let cleanup: (() => void) | null = null;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (isClosed) return;
        const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      };

      // Handshake inicial
      send("connected", { ok: true, workspaces: workspaceIds.length });

      // Escuta apenas os workspaces do usuário, ignorando ações dele mesmo
      const unsubscribe = subscribeToWorkspaces(workspaceIds, (payload) => {
        if (payload.actor.id === userId) return;
        send("notification", payload);
      });

      // Mantém a conexão HTTP ativa
      const heartbeat = setInterval(() => {
        if (isClosed) return;
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 25_000);

      cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Stream já encerrado pelo cliente
        }
      };

      signal.addEventListener("abort", () => cleanup?.(), { once: true });
    },
    cancel() {
      cleanup?.();
    },
  });
}