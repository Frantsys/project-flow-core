import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, BellOff } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getNotifications } from "@/server/services/notification.service";
import { Logo } from "@/components/logo";
import { InboxList } from "@/components/inbox-list";
import { CommandMenuButton } from "@/components/command-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export const metadata: Metadata = { title: "Notificações" };

export default function InboxPage() {
  return (
    <div className="min-h-svh bg-sidebar">
      <header className="flex h-14 items-center justify-between gap-3 border-b bg-background px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <CommandMenuButton className="hidden w-56 sm:flex" />
          <Button asChild variant="ghost">
            <Link href="/workspaces">
              <ArrowLeft aria-hidden="true" />
              Workspaces
            </Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto flex max-w-[760px] flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">Notificações</h1>
          <p className="text-sm text-muted-foreground">
            Atribuições, menções e comentários nas tarefas que você acompanha. Ficam aqui por 90 dias.
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
          <Inbox />
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
