import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { getWorkspace, requireUser } from "@/lib/session";
import { getProjectByKey } from "@/server/services/project.service";
import { can } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectHeader } from "@/components/projects/project-header";
import { CreateTaskDialog } from "@/components/projects/create-task-dialog";
import { ProjectMenu } from "@/components/projects/project-menu";
import { Board as KanbanBoard } from "@/components/projects/board";
import { TaskFilterBar } from "@/components/projects/task-filter-bar";
import { collectTags } from "@/lib/task-filters";

export default function BoardPage({ params }: PageProps<"/w/[workspaceSlug]/projects/[projectKey]">) {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <Board params={params} />
    </Suspense>
  );
}

async function Board({ params }: { params: Promise<{ workspaceSlug: string; projectKey: string }> }) {
  const { workspaceSlug, projectKey } = await params;
  const user = await requireUser();
  const [workspace, project] = await Promise.all([
    getWorkspace(workspaceSlug, user.id),
    getProjectByKey(workspaceSlug, projectKey, user.id),
  ]);

  if (!workspace || !project) notFound();

  return (
    <div className="flex min-w-0 flex-col gap-5 p-6 md:p-8">
      <ProjectHeader
        workspace={workspace}
        project={project}
        view="board"
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

      <TaskFilterBar members={workspace.members} tags={collectTags(project.tasks)} />
      <KanbanBoard
        projectId={project.id}
        statuses={project.statuses}
        tasks={project.tasks}
        currentUserId={user.id}
        taskHref={`/w/${workspace.slug}/projects/${project.key}/tasks`}
        now={new Date().toISOString()}
        canManageColumns={can(workspace.currentUserRole, "project.manage")}
      />
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-5 p-6 md:p-8" aria-busy="true" aria-label="Carregando quadro">
      <Skeleton className="h-14 w-72" />
      <Skeleton className="h-9 w-48" />
      <div className="flex gap-3.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-80 w-[260px] shrink-0 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
