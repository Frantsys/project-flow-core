import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, PartyPopper } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getMyOpenTasks, groupByDue } from "@/server/services/my-work.service";
import { fullDate, priorityBadge } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { CommandMenuButton } from "@/components/command-menu";
import { TaskTypeIndicator } from "@/components/projects/task-type";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export const metadata: Metadata = { title: "Minhas tarefas" };

export default function MyWorkPage() {
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
          <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
            <Account />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto flex max-w-[880px] flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">Minhas tarefas</h1>
          <p className="text-sm text-muted-foreground">
            Tudo o que está com você e ainda não foi concluído, em todos os workspaces.
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
          <MyTasks />
        </Suspense>
      </main>
    </div>
  );
}

async function Account() {
  return <UserMenu user={await requireUser()} />;
}

const todayInBrazil = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

async function MyTasks() {
  const user = await requireUser();
  const tasks = await getMyOpenTasks(user.id);
  const today = todayInBrazil();
  const groups = groupByDue(tasks, today);

  if (groups.length === 0) {
    return (
      <Empty className="border bg-background">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PartyPopper aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Nada pendente com você</EmptyTitle>
          <EmptyDescription>
            Quando alguém atribuir uma tarefa a você, ela aparece aqui, organizada pelo prazo.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return groups.map((group) => (
    <section key={group.id} aria-labelledby={`grp-${group.id}`} className="flex flex-col gap-2">
      <h2 id={`grp-${group.id}`} className="flex items-center gap-2 text-sm font-semibold">
        {group.label}
        <span className="font-medium text-muted-foreground">{group.tasks.length}</span>
      </h2>
      <Card className="gap-0 py-0">
        <ul className="divide-y">
          {group.tasks.map((t) => {
            const priority = priorityBadge[t.priority];
            return (
              <li key={t.id}>
                <Link
                  href={t.href}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm outline-none hover:bg-muted/60 focus-visible:bg-muted"
                >
                  <TaskTypeIndicator type={t.type} />
                  <span className="font-mono text-xs font-medium text-text-secondary">{t.code}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                  <Badge variant="outline">{t.status}</Badge>
                  <Badge variant={priority.variant}>{priority.label}</Badge>
                  <span
                    className={cn(
                      "w-24 text-right text-xs text-muted-foreground",
                      group.id === "overdue" && "font-medium text-destructive-text"
                    )}
                  >
                    {t.dueDate ? fullDate(`${t.dueDate}T12:00:00Z`) : "—"}
                  </span>
                  <span className="w-full truncate text-xs text-muted-foreground sm:w-auto">
                    {t.project.name} · {t.workspace.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  ));
}
