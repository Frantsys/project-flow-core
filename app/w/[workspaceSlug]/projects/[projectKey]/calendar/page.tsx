import { todayInBrazil } from "@/lib/labels";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getWorkspace, requireUser } from "@/lib/session";
import { getProjectByKey } from "@/server/services/project.service";
import { filterTasks, parseTaskFilters } from "@/lib/task-filters";
import { cn } from "@/lib/utils";
import type { TaskDTO } from "@/server/db/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectHeader } from "@/components/projects/project-header";
import { TaskFilterBar } from "@/components/projects/task-filter-bar";
import { TaskTypeIndicator } from "@/components/projects/task-type";

type Query = Promise<Record<string, string | string[] | undefined>>;

export default function CalendarPage({
  params,
  searchParams,
}: PageProps<"/w/[workspaceSlug]/projects/[projectKey]/calendar">) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-[560px] rounded-xl" />}>
      <Calendar params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const monthLabel = (y: number, m: number) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m, 1))
  );
const iso = (d: Date) => d.toISOString().slice(0, 10);
// "novembro de 2026" → "Novembro de 2026" (o capitalize do CSS faria "Novembro De 2026")
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

async function Calendar({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string; projectKey: string }>;
  searchParams: Query;
}) {
  const [{ workspaceSlug, projectKey }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const [workspace, project] = await Promise.all([
    getWorkspace(workspaceSlug, user.id),
    getProjectByKey(workspaceSlug, projectKey, user.id),
  ]);
  if (!workspace || !project) notFound();

  const get = (k: string) => (typeof query[k] === "string" ? (query[k] as string) : null);
  const today = todayInBrazil();
  const [year, month] = (/^\d{4}-\d{2}$/.test(get("month") ?? "") ? get("month")! : today.slice(0, 7))
    .split("-")
    .map(Number) as [number, number];
  const first = new Date(Date.UTC(year, month - 1, 1));
  // começa no domingo da semana do dia 1 e cobre semanas inteiras
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weeks = Math.ceil((first.getUTCDay() + daysInMonth) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d;
  });

  const tasks = filterTasks(project.tasks, parseTaskFilters(get), user.id);
  const byDay = new Map<string, TaskDTO[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const key = t.dueDate.slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), t]);
  }
  const withoutDue = tasks.filter((t) => !t.dueDate).length;
  const doneIds = new Set(project.statuses.filter((s) => s.category === "DONE").map((s) => s.id));

  const base = `/w/${workspace.slug}/projects/${project.key}`;
  const monthHref = (offset: number) => {
    const d = new Date(Date.UTC(year, month - 1 + offset, 1));
    const next = new URLSearchParams(
      Object.entries(query).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))
    );
    next.set("month", iso(d).slice(0, 7));
    return `${base}/calendar?${next}`;
  };

  const chip = (t: TaskDTO) => (
    <Link
      key={t.id}
      href={`${base}/tasks/${t.code}`}
      scroll={false}
      title={`${t.code} ${t.title}`}
      className={cn(
        "flex items-center gap-1.5 truncate rounded-sm px-1 py-0.5 text-xs hover:bg-muted",
        doneIds.has(t.statusId) && "text-muted-foreground line-through"
      )}
    >
      <TaskTypeIndicator type={t.type} />
      <span className="font-mono text-[11px] text-text-secondary">{t.code}</span>
      <span className="truncate">{t.title}</span>
    </Link>
  );

  const agenda = days.filter((d) => d.getUTCMonth() === month - 1 && byDay.has(iso(d)));

  return (
    <div className="flex min-w-0 flex-col gap-5 p-6 md:p-8">
      <ProjectHeader workspace={workspace} project={project} view="calendar" />
      <TaskFilterBar members={workspace.members} />

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="icon" aria-label="Mês anterior">
          <Link href={monthHref(-1)} scroll={false}>
            <ChevronLeft aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="icon" aria-label="Próximo mês">
          <Link href={monthHref(1)} scroll={false}>
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
        <h2 className="text-lg font-semibold" aria-live="polite">
          {sentence(monthLabel(year, month - 1))}
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href={`${base}/calendar`} scroll={false}>
            Hoje
          </Link>
        </Button>
        {withoutDue > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {withoutDue === 1 ? "1 tarefa sem prazo" : `${withoutDue} tarefas sem prazo`} não aparece
            {withoutDue === 1 ? "" : "m"} aqui
          </span>
        )}
      </div>

      {/* tela larga: grade do mês */}
      <Card className="hidden gap-0 overflow-hidden py-0 md:block">
        <div className="grid grid-cols-7 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-1.5" aria-hidden="true">
              {d}
            </div>
          ))}
        </div>
        <ol className="grid grid-cols-7">
          {days.map((d) => {
            const key = iso(d);
            const inMonth = d.getUTCMonth() === month - 1;
            const items = byDay.get(key) ?? [];
            const label = new Intl.DateTimeFormat("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "UTC",
            }).format(d);
            return (
              <li
                key={key}
                aria-label={`${label}${items.length ? `, ${items.length} tarefa${items.length > 1 ? "s" : ""}` : ""}`}
                className={cn(
                  "flex min-h-28 flex-col gap-0.5 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0",
                  !inMonth && "bg-muted/30 text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "mb-0.5 inline-flex size-6 items-center justify-center self-end rounded-full text-xs tabular-nums",
                    key === today && "bg-primary font-semibold text-primary-foreground"
                  )}
                >
                  {d.getUTCDate()}
                </span>
                {items.slice(0, 3).map(chip)}
                {items.length > 3 && (
                  <span className="px-1 text-xs text-muted-foreground">+{items.length - 3} tarefas</span>
                )}
              </li>
            );
          })}
        </ol>
      </Card>

      {/* celular: agenda só com os dias que têm tarefa */}
      <div className="flex flex-col gap-3 md:hidden">
        {agenda.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa com prazo neste mês.</p>
        )}
        {agenda.map((d) => (
          <Card key={iso(d)} className="gap-1 px-3 py-3">
            <h3 className="text-sm font-semibold">
              {sentence(
                new Intl.DateTimeFormat("pt-BR", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                }).format(d)
              )}
            </h3>
            {byDay.get(iso(d))!.map(chip)}
          </Card>
        ))}
      </div>
    </div>
  );
}
