import { Suspense } from "react";
import { Reveal } from "@/components/reveal";
import type { Metadata } from "next";
import { BellOff } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getNotifications } from "@/server/services/notification.service";
import { AppHeader } from "@/components/app-header";
import { InboxList } from "@/components/inbox-list";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export const metadata: Metadata = { title: "Notificações" };

export default function InboxPage() {
  return (
    <div className="min-h-svh bg-sidebar">
      <AppHeader />
      <main className="mx-auto flex max-w-[760px] flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">Notificações</h1>
          <p className="text-sm text-muted-foreground">
            Atribuições, menções e comentários nas tarefas que você acompanha. Ficam aqui por 90 dias.
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
          <Reveal>
            <Inbox />
          </Reveal>
        </Suspense>
      </main>
    </div>
  );
}

async function Inbox() {
  const user = await requireUser();
  const items = await getNotifications(user.id);
  if (items.length === 0) {
    return (
      <Empty className="border bg-background">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BellOff aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Nenhuma notificação</EmptyTitle>
          <EmptyDescription>
            Você será avisado quando atribuírem uma tarefa a você, quando alguém mencionar você com @ ou
            comentar numa tarefa que você criou, recebeu ou comentou.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return <InboxList items={items} />;
}
