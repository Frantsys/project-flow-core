import { can } from "@/lib/permissions";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import { getWorkspace, requireUser } from "@/lib/session";
import { getProjectByKey } from "@/server/services/project.service";
import { fullDate, priorityBadge, sprintBadge } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProjectHeader } from "@/components/projects/project-header";
import { TaskTypeIndicator } from "@/components/projects/task-type";
import { CreateTaskDialog } from "@/components/projects/create-task-dialog";
import { CreateSprintDialog } from "@/components/sprints/create-sprint-dialog";
import { SprintActions } from "@/components/sprints/sprint-actions";
import { ProjectMenu } from "@/components/projects/project-menu";
import { UserAvatar } from "@/components/user-avatar";
import type { ProjectSprintSummaryDTO, TaskDTO } from "@/server/db/types";

export default function BacklogPage({
  params,
}: PageProps<"/w/[workspaceSlug]/projects/[projectKey]/backlog">) {
  return (
    <Suspense fallback={<BacklogSkeleton />}>
      <Backlog params={params} />
    </Suspense>
  );
}

const ORDER = { ACTIVE: 0, PLANNED: 1, COMPLETED: 2 } as const;

async function Backlog({ params }: { params: Promise<{ workspaceSlug: string; projectKey: string }> }) {
  const { workspaceSlug, projectKey } = await params;
  const user = await requireUser();
  const [workspace, project] = await Promise.all([
    getWorkspace(workspaceSlug, user.id),
    getProjectByKey(workspaceSlug, projectKey, user.id),
  ]);

  if (!workspace || !project) notFound();

  const canPlan = can(workspace.currentUserRole, "sprint.manage");
  const base = `/w/${workspace.slug}/projects/${project.key}`;
  const doneStatus = project.statuses[project.statuses.length - 1];
  const sprints = [...project.sprints].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const planned = sprints.filter((s) => s.status === "PLANNED").map((s) => ({ id: s.id, name: s.name }));
  const hasActive = sprints.some((s) => s.status === "ACTIVE");
  const tasksOf = (sprintId: string | null) =>
    project.tasks.filter((t) => (t.sprint?.id ?? null) === sprintId);

  const open = sprints.filter((s) => s.status !== "COMPLETED");
  const completed = sprints.filter((s) => s.status === "COMPLETED");

  const section = (sprint: ProjectSprintSummaryDTO | null) => {
    const tasks = tasksOf(sprint?.id ?? null);
    return (
      <SprintSection
        key={sprint?.id ?? "backlog"}
        sprint={sprint}
        tasks={tasks}
        base={base}
        actions={
          sprint && canPlan ? (
            <SprintActions
              sprint={sprint}
              openTaskCodes={tasks.filter((t) => t.status !== doneStatus).map((t) => t.code)}
              plannedSprints={planned.filter((p) => p.id !== sprint.id)}
              hasActiveSprint={hasActive}
            />
          ) : null
        }
      />
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-5 p-6 md:p-8">
      <ProjectHeader
        workspace={workspace}
        project={project}
        view="backlog"
        actions={
          <div className="flex flex-wrap gap-2">
            {workspace.currentUserRole !== "MEMBER" && (
              <ProjectMenu
                project={{
                  id: project.id,
                  name: project.name,
                  key: project.key,
                  description: project.description,
                  taskCount: project.tasks.length,
                }}
                workspaceSlug={workspace.slug}
              />
            )}
            {canPlan && (
              <CreateSprintDialog
                projectId={project.id}
                suggestedName={`Sprint ${project.sprints.length + 1}`}
                trigger={<Button variant="outline">Nova sprint</Button>}
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

      {open.map(section)}
      {section(null)}

      {completed.length > 0 && (
        <Collapsible className="flex flex-col gap-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="group self-start">
              <ChevronDown
                aria-hidden="true"
                className="transition-transform group-data-[state=closed]:-rotate-90"
              />
              Sprints concluídas ({completed.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-5">{completed.map(section)}</CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function SprintSection({
  sprint,
  tasks,
  base,
  actions,
}: {
  sprint: ProjectSprintSummaryDTO | null;
  tasks: TaskDTO[];
  base: string;
  actions: React.ReactNode;
}) {
  const points = tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
  const badge = sprint ? sprintBadge[sprint.status] : null;
  const dates =
    sprint?.startDate || sprint?.endDate
      ? ` · ${sprint.startDate ? fullDate(sprint.startDate) : "?"} – ${sprint.endDate ? fullDate(sprint.endDate) : "?"}`
      : "";

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b bg-sidebar py-3">
        <CardTitle className="flex items-center gap-2.5 font-semibold">
          {sprint?.name ?? "Backlog"}
          {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
        </CardTitle>
        <CardDescription className="text-[13px]">
          {tasks.length} {tasks.length === 1 ? "tarefa" : "tarefas"} · {points} pts{dates}
          {sprint?.goal && <span className="block text-text-secondary">Meta: {sprint.goal}</span>}
        </CardDescription>
        {actions && <CardAction>{actions}</CardAction>}
      </CardHeader>
      <CardContent className="px-0">
        {tasks.length === 0 ? (
          <p className="px-5 py-4 text-[13px] text-muted-foreground">
            {sprint
              ? "Nenhuma tarefa. Mova tarefas para cá pelo campo Sprint da tarefa."
              : "Nenhuma tarefa fora de sprints."}
          </p>
        ) : (
          <Table>
            <TableHeader className="sr-only">
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Pontos</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const priority = priorityBadge[task.priority];
                return (
                  <TableRow key={task.id}>
                    <TableCell className="w-28 pl-5">
                      <span className="inline-flex items-center gap-2">
                        <TaskTypeIndicator type={task.type} />
                        <span className="font-mono text-xs font-medium text-text-secondary">{task.code}</span>
                      </span>
                    </TableCell>
                    <TableCell className="font-medium whitespace-normal">
                      <Link
                        href={`${base}/tasks/${task.code}`}
                        scroll={false}
                        className="underline-offset-4 hover:underline"
                      >
                        {task.title}
                      </Link>
                    </TableCell>
                    <TableCell className="w-36">
                      <Badge variant="outline">{task.status}</Badge>
                    </TableCell>
                    <TableCell className="w-28">
                      <Badge variant={priority.variant}>{priority.label}</Badge>
                    </TableCell>
                    <TableCell className="w-20 text-text-secondary tabular-nums">
                      {task.storyPoints ?? "—"} pts
                    </TableCell>
                    <TableCell className="w-12 pr-5">
                      {task.assignee ? (
                        <UserAvatar name={task.assignee.name} image={task.assignee.image} size="sm" />
                      ) : (
                        <span className="text-muted-foreground" title="Sem responsável">
                          —
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function BacklogSkeleton() {
  return (
    <div className="flex flex-col gap-5 p-6 md:p-8" aria-busy="true" aria-label="Carregando backlog">
      <Skeleton className="h-14 w-72" />
      <Skeleton className="h-9 w-48" />
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-44 rounded-xl" />
      ))}
    </div>
  );
}
