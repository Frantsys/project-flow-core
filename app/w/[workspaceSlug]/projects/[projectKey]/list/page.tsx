import { cn } from "@/lib/utils";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { getWorkspace, requireUser } from "@/lib/session";
import { getProjectByKey } from "@/server/services/project.service";
import { filterTasks, parseTaskFilters } from "@/lib/task-filters";
import { fullDate, priorityBadge, todayInBrazil } from "@/lib/labels";
import type { TaskDTO } from "@/server/db/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProjectHeader } from "@/components/projects/project-header";
import { TaskFilterBar } from "@/components/projects/task-filter-bar";
import { TaskTypeIndicator } from "@/components/projects/task-type";
import { UserAvatar } from "@/components/user-avatar";

type Query = Promise<Record<string, string | string[] | undefined>>;

export default function ListPage({
  params,
  searchParams,
}: PageProps<"/w/[workspaceSlug]/projects/[projectKey]/list">) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96 rounded-xl" />}>
      <TaskList params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
const COLUMNS = [
  { key: "code", label: "Código" },
  { key: "title", label: "Título" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Prioridade" },
  { key: "assignee", label: "Responsável" },
  { key: "points", label: "Pontos" },
  { key: "due", label: "Prazo" },
] as const;
type SortKey = (typeof COLUMNS)[number]["key"];

async function TaskList({
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
  const sort: SortKey = COLUMNS.some((c) => c.key === get("sort")) ? (get("sort") as SortKey) : "code";
  const desc = get("dir") === "desc";
  const statusIndex = new Map(project.statuses.map((s, i) => [s.id, i]));
  const statusName = new Map(project.statuses.map((s) => [s.id, s.name]));
  const doneIds = new Set(project.statuses.filter((s) => s.category === "DONE").map((s) => s.id));
  const today = todayInBrazil();
  const overdue = (t: TaskDTO) => !!t.dueDate && t.dueDate.slice(0, 10) < today && !doneIds.has(t.statusId);
  const number = (code: string) => Number(code.split("-")[1] ?? 0);

  // valores vazios (sem prazo, sem pontos, sem responsável) ficam sempre no fim
  const value = (t: TaskDTO): string | number | null => {
    switch (sort) {
      case "code":
        return number(t.code);
      case "title":
        return t.title.toLocaleLowerCase("pt-BR");
      case "status":
        return statusIndex.get(t.statusId) ?? 99;
      case "priority":
        return PRIORITY_ORDER[t.priority];
      case "assignee":
        return t.assignee?.name.toLocaleLowerCase("pt-BR") ?? null;
      case "points":
        return t.storyPoints;
      case "due":
        return t.dueDate;
    }
  };
  const tasks = filterTasks(project.tasks, parseTaskFilters(get), user.id).sort((a, b) => {
    const [va, vb] = [value(a), value(b)];
    if (va === vb) return number(a.code) - number(b.code);
    if (va === null) return 1;
    if (vb === null) return -1;
    const order = va < vb ? -1 : 1;
    return desc ? -order : order;
  });

  const base = `/w/${workspace.slug}/projects/${project.key}`;
  const sortHref = (key: SortKey) => {
    const next = new URLSearchParams(
      Object.entries(query).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))
    );
    next.set("sort", key);
    next.set("dir", key === sort && !desc ? "desc" : "asc");
    return `${base}/list?${next}`;
  };

  return (
    <div className="flex min-w-0 flex-col gap-5 p-6 md:p-8">
      <ProjectHeader workspace={workspace} project={project} view="list" />
      <TaskFilterBar members={workspace.members} />
      <Card className="gap-0 overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((c) => (
                  <TableHead
                    key={c.key}
                    aria-sort={c.key === sort ? (desc ? "descending" : "ascending") : undefined}
                    className="first:pl-5"
                  >
                    <Link
                      href={sortHref(c.key)}
                      scroll={false}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {c.label}
                      {c.key === sort &&
                        (desc ? (
                          <ArrowDown className="size-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowUp className="size-3.5" aria-hidden="true" />
                        ))}
                    </Link>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} className="py-10 text-center text-muted-foreground">
                    Nenhuma tarefa com esses filtros.
                  </TableCell>
                </TableRow>
              )}
              {tasks.map((t) => {
                const priority = priorityBadge[t.priority];
                return (
                  <TableRow key={t.id}>
                    <TableCell className="w-28 pl-5">
                      <span className="inline-flex items-center gap-2">
                        <TaskTypeIndicator type={t.type} />
                        <span className="font-mono text-xs font-medium text-text-secondary">{t.code}</span>
                      </span>
                    </TableCell>
                    <TableCell className="min-w-56 font-medium whitespace-normal">
                      <Link
                        href={`${base}/tasks/${t.code}`}
                        scroll={false}
                        className="underline-offset-4 hover:underline"
                      >
                        {t.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{statusName.get(t.statusId)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={priority.variant}>{priority.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {t.assignee ? (
                        <span className="inline-flex items-center gap-2">
                          <UserAvatar name={t.assignee.name} image={t.assignee.image} size="sm" />
                          {t.assignee.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-text-secondary tabular-nums">{t.storyPoints ?? "—"}</TableCell>
                    <TableCell
                      className={cn("text-text-secondary", overdue(t) && "font-medium text-destructive-text")}
                    >
                      {t.dueDate ? fullDate(t.dueDate) : "—"}
                      {overdue(t) && <span className="sr-only"> (atrasada)</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {tasks.length === 1 ? "1 tarefa" : `${tasks.length} tarefas`}
      </p>
    </div>
  );
}
