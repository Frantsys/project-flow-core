import { Suspense } from "react";
import { Reveal } from "@/components/reveal";
import Link from "next/link";
import type { Metadata } from "next";
import { Building2, Plus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/session";
import { getUserWorkspaces } from "@/server/services/workspace.service";
import { fullDate, initials, roleLabel } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";

export const metadata: Metadata = { title: "Workspaces" };

export default function WorkspacesPage() {
  return (
    <div className="min-h-svh bg-sidebar">
      <AppHeader current="/workspaces" />
      <main className="mx-auto flex max-w-[1040px] flex-col gap-6 px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="mb-1 text-2xl font-semibold tracking-tight">Seus workspaces</h1>
            <p className="text-sm text-muted-foreground">
              Escolha um workspace para continuar ou crie um novo.
            </p>
          </div>
          <CreateWorkspaceDialog
            trigger={
              <Button>
                <Plus aria-hidden="true" />
                Novo workspace
              </Button>
            }
          />
        </div>
        <Suspense fallback={<GridSkeleton />}>
          <Reveal>
            <WorkspaceGrid />
          </Reveal>
        </Suspense>
      </main>
    </div>
  );
}

async function WorkspaceGrid() {
  const user = await requireUser();
  const workspaces = await getUserWorkspaces(user.id);

  if (workspaces.length === 0) {
    return (
      <Empty className="border bg-background">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building2 aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Você ainda não tem workspaces</EmptyTitle>
          <EmptyDescription>
            Um workspace reúne os projetos e as pessoas do seu time. Crie o primeiro para começar.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <CreateWorkspaceDialog trigger={<Button>Criar workspace</Button>} />
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
      {workspaces.map((ws) => (
        <Link
          key={ws.id}
          href={`/w/${ws.slug}`}
          className="group rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Card className="h-full transition-colors group-hover:border-border-strong">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] border bg-muted text-sm font-semibold">
                  {initials(ws.name)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold">{ws.name}</div>
                  <CardDescription className="truncate text-[13px]">/{ws.slug}</CardDescription>
                </div>
              </CardTitle>
              <CardAction>
                <Badge variant="outline">{roleLabel[ws.role]}</Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="justify-between text-[13px] text-muted-foreground">
              <span>
                {ws.memberCount} {ws.memberCount === 1 ? "membro" : "membros"}
              </span>
              <span>Criado em {fullDate(ws.createdAt)}</span>
            </CardFooter>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4"
      aria-busy="true"
      aria-label="Carregando workspaces"
    >
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[132px] rounded-xl" />
      ))}
    </div>
  );
}
