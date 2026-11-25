import "server-only";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { appUrl, sendEmail } from "@/lib/email";
import { describeNotification } from "@/lib/notification-format";
import { Notification, User, type NotificationType } from "../db/models";
import type { PersonDTO } from "../db/types";

type Id = Types.ObjectId | string;

// comentar gera muito aviso: por e-mail vão só atribuição e menção (o resto fica na caixa de entrada)
const EMAIL_TYPES = new Set<NotificationType>(["ASSIGNED", "MENTIONED"]);

interface NotifyInput {
  type: NotificationType;
  recipients: (Id | null | undefined)[];
  actorId: Id;
  workspaceId: Id;
  taskId?: Id | null;
  title: string;
  href: string;
}

/**
 * Cria a notificação para cada destinatário (nunca para quem fez a ação) e manda e-mail para quem
 * aceita receber. Falha de e-mail não desfaz nada: só vai para o log.
 */
export async function notify({ type, recipients, actorId, workspaceId, taskId, title, href }: NotifyInput) {
  const actor = String(actorId);
  const ids = [...new Set(recipients.filter(Boolean).map(String))].filter((id) => id !== actor);
  if (ids.length === 0) return 0;
  await dbConnect();

  await Notification.insertMany(
    ids.map((userId) => ({ userId, type, actorId, workspaceId, taskId: taskId ?? null, title, href }))
  );

  if (EMAIL_TYPES.has(type)) {
    const [users, actorUser] = await Promise.all([
      User.find({ _id: { $in: ids }, notifyByEmail: { $ne: false } })
        .select("email")
        .lean(),
      User.findById(actor).select("username").lean(),
    ]);
    const text = describeNotification(type, actorUser?.username ?? "Alguém", title);
    await Promise.all(
      users.map((u) =>
        sendEmail({
          to: u.email,
          subject: text,
          intro: `${text}.`,
          action: { label: "Abrir no Project Flow", url: `${appUrl()}${href}` },
          footnote: "Para parar de receber estes e-mails, desligue a opção em Minha conta › Notificações.",
        }).catch((error) => console.error("[email:notify]", error))
      )
    );
  }
  return ids.length;
}

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  actor: PersonDTO | null;
  title: string;
  href: string;
  read: boolean;
  createdAt: string;
}

export async function getNotifications(userId: string, limit = 50): Promise<NotificationDTO[]> {
  if (!Types.ObjectId.isValid(userId)) return [];
  await dbConnect();
  const items = await Notification.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate<{ actorId: { _id: Types.ObjectId; username: string; image?: string | null } | null }>(
      "actorId",
      "username image"
    )
    .lean();
  return items.map((n) => ({
    id: n._id.toString(),
    type: n.type,
    actor: n.actorId
      ? { id: n.actorId._id.toString(), name: n.actorId.username, image: n.actorId.image ?? null }
      : null,
    title: n.title,
    href: n.href,
    read: !!n.readAt,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function countUnread(userId: string) {
  if (!Types.ObjectId.isValid(userId)) return 0;
  await dbConnect();
  return Notification.countDocuments({ userId, readAt: null });
}
