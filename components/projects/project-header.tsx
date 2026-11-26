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

const VIEWS = [
  { id: "board", label: "Quadro", icon: SquareKanban, path: "" },
  { id: "backlog", label: "Backlog", icon: List, path: "/backlog" },
  { id: "list", label: "Lista", icon: Rows3, path: "/list" },
  { id: "calendar", label: "Calendário", icon: CalendarDays, path: "/calendar" },
  { id: "reports", label: "Relatórios", icon: ChartColumn, path: "/reports" },
] as const;

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
      {/* navegação entre páginas, não abas: links com aria-current (abas sem painel confundem o leitor de tela) */}
      <nav aria-label="Visões do projeto">
        <ul className="inline-flex h-8 w-fit max-w-full items-center overflow-x-auto overflow-y-hidden rounded-lg bg-muted p-[3px] text-muted-foreground">
          {VIEWS.map((v) => (
            <li key={v.id} className="h-full">
              <Link
                href={`${base}${v.path}`}
                aria-current={v.id === view ? "page" : undefined}
                aria-label={v.label}
                className="inline-flex h-full items-center gap-1.5 rounded-md border border-transparent px-1.5 text-sm font-medium whitespace-nowrap text-foreground/60 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:bg-background aria-[current=page]:text-foreground aria-[current=page]:shadow-sm dark:text-muted-foreground dark:aria-[current=page]:border-input dark:aria-[current=page]:bg-input/30 [&_svg]:size-4 [&_svg]:shrink-0"
              >
                <v.icon aria-hidden="true" />
                <span className={v.id === view ? undefined : "hidden sm:inline"}>{v.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
