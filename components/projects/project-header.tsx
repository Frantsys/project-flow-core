import Link from "next/link";
import { CalendarDays, ChartColumn, List, Rows3, SquareKanban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Trilha, nome do projeto e as visões (Quadro, Backlog, Lista, Calendário, Relatórios), cada uma com a própria URL. */
export function ProjectHeader({
  workspace,
  project,
  view,
  actions,
}: {
  workspace: { name: string; slug: string };
  project: { name: string; key: string };
  view: "board" | "backlog" | "list" | "calendar" | "reports";
  actions?: React.ReactNode;
}) {
  const base = `/w/${workspace.slug}/projects/${project.key}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/w/${workspace.slug}`}>{workspace.name}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{project.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
            {project.name} <Badge variant="outline">{project.key}</Badge>
          </h1>
          {actions}
        </div>
      </div>
      <Tabs value={view}>
        <TabsList className="max-w-full overflow-x-auto overflow-y-hidden">
          <TabsTrigger value="board" asChild>
            <Link href={base}>
              <SquareKanban aria-hidden="true" />
              Quadro
            </Link>
          </TabsTrigger>
          <TabsTrigger value="backlog" asChild>
            <Link href={`${base}/backlog`}>
              <List aria-hidden="true" />
              Backlog
            </Link>
          </TabsTrigger>
          <TabsTrigger value="list" asChild>
            <Link href={`${base}/list`}>
              <Rows3 aria-hidden="true" />
              Lista
            </Link>
          </TabsTrigger>
          <TabsTrigger value="calendar" asChild>
            <Link href={`${base}/calendar`}>
              <CalendarDays aria-hidden="true" />
              Calendário
            </Link>
          </TabsTrigger>
          <TabsTrigger value="reports" asChild>
            <Link href={`${base}/reports`}>
              <ChartColumn aria-hidden="true" />
              Relatórios
            </Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
