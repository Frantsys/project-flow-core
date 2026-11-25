import type { NotificationType } from "@/server/db/models";

/** Frase da notificação, com quem fez e o alvo: "Marina mencionou você em PF-12 Login". */
export function describeNotification(type: NotificationType, actor: string, title: string) {
  switch (type) {
    case "ASSIGNED":
      return `${actor} atribuiu ${title} a você`;
    case "MENTIONED":
      return `${actor} mencionou você em ${title}`;
    case "COMMENTED":
      return `${actor} comentou em ${title}`;
    case "INVITE_ACCEPTED":
      return `${actor} aceitou o convite e entrou em ${title}`;
  }
}
