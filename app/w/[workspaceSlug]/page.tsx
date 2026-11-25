import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";
import { getWorkspace, requireUser } from "@/lib/session";
import { getProjectsByWorkspaceSlug } from "@/server/services/project.service";
import { getWorkspaceHistory } from "@/server/services/history.service";
import { HistoryList } from "@/components/history-list";
import { roleLabel } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { UserAvatar } from "@/components/user-avatar";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";

export default function WorkspaceOverviewPage({ params }: PageProps<"/w/[workspaceSlug]">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview params={params} />
    </Suspense>
  );
}

async function Overview({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const [workspace, projects, activity] = await Promise.all([
    getWorkspace(workspaceSlug, user.id),
    getProjectsByWorkspaceSlug(workspaceSlug, user.id),
    getWorkspaceHistory(workspaceSlug, user.id, 8),
  ]);

  if (!workspace || !projects || !activity) notFound();

  const canManage = workspace.currentUserRole !== "MEMBER";
  const newProject = canManage ? (
    <CreateProjectDialog
      workspaceId={workspace.id}
      workspaceSlug={workspace.slug}
      trigger={
        <Button>
          <Plus aria-hidden="true" />
          Novo projeto
        </Button>
      }
    />
  ) : null;

  return (
    <div className="flex flex-col gap-7 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">{workspace.name}</h1>
          <p className="text-sm text-muted-foreground">
            Dono: {workspace.owner.name} · {workspace.stats.projectsCount}{" "}
            {workspace.stats.projectsCount === 1 ? "projeto" : "projetos"} · {workspace.stats.membersCount}{" "}
            {workspace.stats.membersCount === 1 ? "membro" : "membros"}
          </p>
        </div>
        {newProject}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Projetos</h2>
        {projects.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderKanban aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Nenhum projeto neste workspace</EmptyTitle>
              <EmptyDescription>
                {canManage
                  ? "Crie um projeto para ter um quadro kanban e planejar sprints."
                  : "Peça para um dono ou admin criar o primeiro projeto."}
              </EmptyDescription>
            </EmptyHeader>
            {newProject && <EmptyContent>{newProject}</EmptyContent>}
          </Empty>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/w/${workspace.slug}/projects/${project.key}`}
                className="group rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Card className="h-full transition-colors group-hover:border-border-strong">
                  <CardHeader>
                    <CardTitle className="text-[15px] font-semibold">{project.name}</CardTitle>
                    <CardAction>
                      <Badge variant="outline">{project.key}</Badge>
                    </CardAction>
                    <CardDescription className="line-clamp-2 text-[13px]">
                      {project.description || "Sem descrição."}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="font-semibold">Membros</CardTitle>
          <CardAction>
            <Button variant="link" size="sm" asChild>
              <Link href={`/w/${workspace.slug}/settings?tab=membros`}>Gerenciar</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ItemGroup>
            {workspace.members.map((member) => (
              <Item key={member.id} size="sm" className="px-0">
                <ItemMedia>
                  <UserAvatar name={member.name} image={member.image} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{member.name}</ItemTitle>
                  <ItemDescription>{member.email}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge variant="outline">{roleLabel[member.role]}</Badge>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-semibold">Atividade recente</CardTitle>
          <CardAction>
            <Button variant="link" size="sm" asChild>
              <Link href={`/w/${workspace.slug}/settings?tab=historico`}>Ver tudo</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <HistoryList entries={activity} />
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-7 p-6 md:p-8" aria-busy="true" aria-label="Carregando workspace">
      <Skeleton className="h-12 w-72" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}
