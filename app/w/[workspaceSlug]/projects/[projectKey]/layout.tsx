import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { can } from "@/lib/permissions";
import { getProject, getWorkspace, requireUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectHeader } from "@/components/projects/project-header";
import { ProjectMenu } from "@/components/projects/project-menu";
import { CreateTaskDialog } from "@/components/projects/create-task-dialog";

/**
 * Cabeçalho do projeto (trilha, nome, ações e visões) fica aqui, e não em cada página: ao trocar
 * de visão ele continua no lugar e só o conteúdo muda. `modal` recebe a tarefa aberta por cima do
 * quadro/backlog (rota interceptada em @modal).
 */
export default function ProjectLayout({
  children,
  modal,
  params,
}: LayoutProps<"/w/[workspaceSlug]/projects/[projectKey]">) {
  return (
    <>
      <div className="min-w-0 px-6 pt-6 md:px-8 md:pt-8">
        <Suspense fallback={<HeaderSkeleton />}>
          <Header params={params} />
        </Suspense>
      </div>
      {children}
      {modal}
    </>
  );
}

async function Header({ params }: { params: Promise<{ workspaceSlug: string; projectKey: string }> }) {
  const { workspaceSlug, projectKey } = await params;
  const user = await requireUser();
  const [workspace, project] = await Promise.all([
    getWorkspace(workspaceSlug, user.id),
    getProject(workspaceSlug, projectKey, user.id),
  ]);
  if (!workspace || !project) notFound();

  return (
    <ProjectHeader
      workspace={workspace}
      project={project}
      actions={
        <div className="flex flex-wrap gap-2">
          {can(workspace.currentUserRole, "project.manage") && (
            <ProjectMenu
              project={{
                id: project.id,
                name: project.name,
                key: project.key,
                description: project.description,
                taskCount: project.tasks.length,
              }}
              statuses={project.statuses}
              taskStatusIds={project.tasks.map((t) => t.statusId)}
              workspaceSlug={workspace.slug}
            />
          )}
          <CreateTaskDialog
            projectId={project.id}
            statuses={project.statuses}
            trigger={
              <Button data-shortcut="c" aria-keyshortcuts="C" title="Nova tarefa (C)">
                <Plus aria-hidden="true" />
                Nova tarefa
              </Button>
            }
          />
        </div>
      }
    />
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-14 w-72" />
      <Skeleton className="h-8 w-80" />
    </div>
  );
}
