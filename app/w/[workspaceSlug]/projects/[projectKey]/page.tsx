import { Suspense } from "react";
import { Reveal } from "@/components/reveal";
import { notFound } from "next/navigation";
import { getProject, getWorkspace, requireUser } from "@/lib/session";
import { getSavedViews } from "@/server/services/view.service";
import { can } from "@/lib/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { Board as KanbanBoard } from "@/components/projects/board";
import { TaskFilterBar } from "@/components/projects/task-filter-bar";
import { collectTags } from "@/lib/task-filters";

export default function BoardPage({ params }: PageProps<"/w/[workspaceSlug]/projects/[projectKey]">) {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <Reveal>
        <Board params={params} />
      </Reveal>
    </Suspense>
  );
}

async function Board({ params }: { params: Promise<{ workspaceSlug: string; projectKey: string }> }) {
  const { workspaceSlug, projectKey } = await params;
  const user = await requireUser();
  const [workspace, project] = await Promise.all([
    getWorkspace(workspaceSlug, user.id),
    getProject(workspaceSlug, projectKey, user.id),
  ]);

  if (!workspace || !project) notFound();

  return (
    <div className="flex min-w-0 flex-col gap-5 px-6 pt-5 pb-6 md:px-8 md:pb-8">
      <TaskFilterBar
        members={workspace.members}
        tags={collectTags(project.tasks)}
        projectId={project.id}
        views={await getSavedViews(project.id, user.id)}
        grouping
      />
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
    <div
      className="flex flex-col gap-5 px-6 pt-5 pb-6 md:px-8"
      aria-busy="true"
      aria-label="Carregando quadro"
    >
      <Skeleton className="h-9 w-full max-w-3xl" />
      <div className="flex gap-3.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-80 w-[260px] shrink-0 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
