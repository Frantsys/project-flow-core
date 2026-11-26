import Link from "next/link";
import { CalendarClock, ListChecks } from "lucide-react";
import { fullDate, priorityBadge, shortDate } from "@/lib/labels";
import { projectMetrics } from "@/lib/project-metrics";
import { cn } from "@/lib/utils";
import { getMyOpenTasks } from "@/server/services/my-work.service";
import { getProjectByKey } from "@/server/services/project.service";
import type { ProjectDTO } from "@/server/db/types";
import { Meter } from "@/components/reports/charts";
import { TaskTypeIndicator } from "@/components/projects/task-type";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const MY_TASKS = 5;

/**
 * "O que importa agora" no topo da visão geral: as sprints em andamento de cada projeto e o que
 * está com a pessoa neste workspace (atrasadas primeiro). O resto da página é contexto.
 */
export async function NowSection({
  workspaceSlug,
  projects,
  userId,
  today,
}: {
  workspaceSlug: string;
  projects: ProjectDTO[];
  userId: string;
  /** "AAAA-MM-DD", calculado pela página depois da sessão (Cache Components). */
  today: string;
}) {
  const [details, allMine] = await Promise.all([
    Promise.all(projects.map((p) => getProjectByKey(workspaceSlug, p.key, userId))),
    getMyOpenTasks(userId),
  ]);

  const sprints = details.flatMap((project) => {
    const sprint = project && projectMetrics(project, today).activeSprint;
    return project && sprint ? [{ project, sprint }] : [];
  });

  // atrasadas e com prazo mais perto primeiro; sem prazo no fim
  const mine = allMine
    .filter((t) => t.workspace.slug === workspaceSlug)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));

  return (
    <section aria-labelledby="agora" className="grid gap-4 lg:grid-cols-2">
      <h2 id="agora" className="sr-only">
        Agora
      </h2>

      <Card>
        <CardHeader>
          <CardTitle className="font-semibold">Sprints em andamento</CardTitle>
          <CardDescription>
            {sprints.length === 0
              ? "Nenhum projeto tem sprint ativa agora."
              : "Pontos concluídos em cada sprint ativa."}
          </CardDescription>
        </CardHeader>
        {sprints.length > 0 && (
          <CardContent className="flex flex-col gap-5">
            {sprints.map(({ project, sprint }) => (
              <div key={project.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <Link
                    href={`/w/${workspaceSlug}/projects/${project.key}/backlog`}
                    className="text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {project.name} · {sprint.name}
                  </Link>
                  {sprint.endDate && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5" aria-hidden="true" />
                      termina em {fullDate(sprint.endDate)}
                    </span>
                  )}
                </div>
                <Meter label="Pontos concluídos" value={sprint.donePoints} total={sprint.totalPoints} />
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-semibold">Com você neste workspace</CardTitle>
          <CardDescription>
            {mine.length === 0
              ? "Nenhuma tarefa aberta atribuída a você."
              : `${mine.length} ${mine.length === 1 ? "tarefa aberta" : "tarefas abertas"}, as mais urgentes primeiro.`}
          </CardDescription>
          <CardAction>
            <Button variant="link" size="sm" asChild>
              <Link href="/my-work">
                <ListChecks aria-hidden="true" />
                Ver todas
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        {mine.length > 0 && (
          <CardContent>
            <ul className="flex flex-col divide-y">
              {mine.slice(0, MY_TASKS).map((t) => {
                const overdue = !!t.dueDate && t.dueDate < today;
                return (
                  <li key={t.id}>
                    <Link
                      href={t.href}
                      className="flex items-center gap-2.5 rounded-sm py-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <TaskTypeIndicator type={t.type} />
                      <span className="font-mono text-xs whitespace-nowrap text-text-secondary">
                        {t.code}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      <Badge variant={priorityBadge[t.priority].variant}>
                        {priorityBadge[t.priority].label}
                      </Badge>
                      <span
                        className={cn(
                          "w-14 text-right text-xs whitespace-nowrap text-muted-foreground",
                          overdue && "font-medium text-destructive-text"
                        )}
                      >
                        {t.dueDate ? shortDate(t.dueDate, new Date(`${today}T00:00:00Z`)) : "—"}
                        {overdue && <span className="sr-only"> (atrasada)</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        )}
      </Card>
    </section>
  );
}
