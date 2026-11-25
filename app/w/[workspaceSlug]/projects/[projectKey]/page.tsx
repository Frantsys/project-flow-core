import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, UserRound } from "lucide-react";
import { getWorkspace, requireUser } from "@/lib/session";
import { getProjectByKey } from "@/server/services/project.service";
import { priorityBadge, shortDate } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectHeader } from "@/components/projects/project-header";
import { TaskTypeIndicator } from "@/components/projects/task-type";
import { CreateTaskDialog } from "@/components/projects/create-task-dialog";
import { TaskStatusMenu } from "@/components/projects/task-status-menu";
import { ProjectMenu } from "@/components/projects/project-menu";
import type { StatusDTO, TaskDTO } from "@/server/db/types";
import { can } from "@/lib/permissions";

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

  const now = new Date();

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
                <Button>
                  <Plus aria-hidden="true" />
                  Nova tarefa
                </Button>
              }
            />
          </div>
        }
      />

      {/* O quadro rola na horizontal dentro do próprio container, nunca a página */}
      <div className="-mx-6 overflow-x-auto px-6 pb-2 md:-mx-8 md:px-8">
        <div className="flex min-w-min items-start gap-3.5">
          {project.statuses.map((status) => {
            const tasks = project.tasks.filter((t) => t.statusId === status.id);
            return (
              <section
                key={status.id}
                aria-labelledby={`col-${status.id}`}
                className="flex w-[260px] shrink-0 flex-col gap-2.5 rounded-xl bg-muted p-2.5"
              >
                <div className="flex items-center justify-between px-1">
                  <h2 id={`col-${status.id}`} className="flex items-center gap-2 text-sm font-semibold">
                    {status.name}
                    <span className="font-medium text-muted-foreground">{tasks.length}</span>
                  </h2>
                  <CreateTaskDialog
                    projectId={project.id}
                    statuses={project.statuses}
                    defaultStatusId={status.id}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Nova tarefa em ${status.name}`}>
                        <Plus aria-hidden="true" />
                      </Button>
                    }
                  />
                </div>
                {tasks.length === 0 ? (
                  <p className="rounded-[10px] border border-dashed border-border-strong p-4 text-center text-[13px] text-muted-foreground">
                    Nenhuma tarefa aqui. Use + para criar.
                  </p>
                ) : (
                  tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      statuses={project.statuses}
                      href={`/w/${workspace.slug}/projects/${project.key}/tasks/${task.code}`}
                      now={now}
                    />
                  ))
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  statuses,
  href,
  now,
}: {
  task: TaskDTO;
  statuses: StatusDTO[];
  href: string;
  now: Date;
}) {
  const priority = priorityBadge[task.priority];
  const due = task.dueDate ? shortDate(task.dueDate, now) : null;
  const overdue = task.dueDate ? new Date(task.dueDate) < now : false;

  return (
    <Card
      size="sm"
      className="relative rounded-[10px] shadow-xs transition-colors hover:border-border-strong has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50"
    >
      <CardHeader className="flex items-center gap-2">
        <TaskTypeIndicator type={task.type} />
        <span className="font-mono text-xs font-medium text-text-secondary">{task.code}</span>
        <Badge variant={priority.variant} className="ml-auto">
          {priority.label}
        </Badge>
        <div className="relative z-10">
          <TaskStatusMenu
            taskId={task.id}
            taskCode={task.code}
            statusId={task.statusId}
            statuses={statuses}
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <CardTitle className="line-clamp-3 text-sm leading-snug font-medium">
          {/* o link cobre o card inteiro (after:inset-0); o menu fica por cima com z-10 */}
          <Link
            href={href}
            scroll={false}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {task.title}
          </Link>
        </CardTitle>
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          {task.storyPoints !== null && (
            <Badge variant="outline" className="h-5 px-1.5">
              {task.storyPoints} pts
            </Badge>
          )}
          {due && (
            <span className={cn((overdue || due === "hoje") && "font-medium text-destructive-text")}>
              {due}
            </span>
          )}
          {task.sprint && <span className="truncate">{task.sprint.name}</span>}
          {task.assignee ? (
            <UserAvatar name={task.assignee.name} image={task.assignee.image} size="sm" className="ml-auto" />
          ) : (
            <Avatar className="ml-auto size-6" title="Sem responsável">
              <AvatarFallback className="bg-avatar text-badge-foreground">
                <UserRound className="size-3.5" aria-label="Sem responsável" />
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </CardContent>
    </Card>
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
