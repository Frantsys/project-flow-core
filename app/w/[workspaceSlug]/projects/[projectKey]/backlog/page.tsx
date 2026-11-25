import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getWorkspace, requireUser } from "@/lib/session";
import { getProjectByKey } from "@/server/services/project.service";
import { priorityBadge, sprintBadge } from "@/lib/labels";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProjectHeader } from "@/components/projects/project-header";
import { TaskTypeIndicator } from "@/components/projects/task-type";
import { CreateTaskDialog } from "@/components/projects/create-task-dialog";
import type { SprintStatus, TaskDTO } from "@/server/db/types";

export default function BacklogPage({ params }: PageProps<"/w/[workspaceSlug]/projects/[projectKey]/backlog">) {
  return (
    <Suspense fallback={<BacklogSkeleton />}>
      <Backlog params={params} />
    </Suspense>
  );
}

async function Backlog({ params }: { params: Promise<{ workspaceSlug: string; projectKey: string }> }) {
  const { workspaceSlug, projectKey } = await params;
  const user = await requireUser();
  const [workspace, project] = await Promise.all([
    getWorkspace(workspaceSlug, user.id),
    getProjectByKey(workspaceSlug, projectKey, user.id),
  ]);

  if (!workspace || !project) notFound();

  // shortcut: TaskDTO só traz o nome da sprint, então o agrupamento é por nome; trocar por sprintId quando o DTO tiver
  const groups: { name: string; status: SprintStatus | null; tasks: TaskDTO[] }[] = [
    ...project.sprints.map((s) => ({
      name: s.name,
      status: s.status,
      tasks: project.tasks.filter((t) => t.sprint?.name === s.name),
    })),
    { name: "Backlog", status: null, tasks: project.tasks.filter((t) => !t.sprint) },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-5 p-6 md:p-8">
      <ProjectHeader
        workspace={workspace}
        project={project}
        view="backlog"
        actions={
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
        }
      />

      {groups.map((group) => {
        const points = group.tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
        const badge = group.status ? sprintBadge[group.status] : null;
        return (
          <Card key={group.name} className="gap-0 py-0">
            <CardHeader className="border-b bg-sidebar py-3">
              <CardTitle className="flex items-center gap-2.5 font-semibold">
                {group.name}
                {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
              </CardTitle>
              <CardDescription className="text-[13px]">
                {group.tasks.length} {group.tasks.length === 1 ? "tarefa" : "tarefas"} · {points} pts
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {group.tasks.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-muted-foreground">Nenhuma tarefa.</p>
              ) : (
                <Table>
                  <TableHeader className="sr-only">
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Pontos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.tasks.map((task) => {
                      const priority = priorityBadge[task.priority];
                      return (
                        <TableRow key={task.id}>
                          <TableCell className="w-28 pl-5">
                            <span className="inline-flex items-center gap-2">
                              <TaskTypeIndicator type={task.type} />
                              <span className="font-mono text-xs font-medium text-text-secondary">{task.code}</span>
                            </span>
                          </TableCell>
                          <TableCell className="font-medium whitespace-normal">{task.title}</TableCell>
                          <TableCell className="w-36">
                            <Badge variant="outline">{task.status}</Badge>
                          </TableCell>
                          <TableCell className="w-28">
                            <Badge variant={priority.variant}>{priority.label}</Badge>
                          </TableCell>
                          <TableCell className="w-20 pr-5 text-text-secondary tabular-nums">
                            {task.storyPoints ?? "—"} pts
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
      })}
    </div>
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
