import Link from "next/link";
import { NAV } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ProjectTabs } from "./project-tabs";

/**
 * Trilha, nome do projeto, ações e as visões (Quadro, Backlog, Lista, Calendário, Relatórios).
 * Vive no layout do projeto: trocar de visão troca só o conteúdo embaixo.
 */
export function ProjectHeader({
  workspace,
  project,
  actions,
}: {
  workspace: { name: string; slug: string };
  project: { name: string; key: string };
  actions?: React.ReactNode;
}) {
  const base = `/w/${workspace.slug}/projects/${project.key}`;

  return (
    <div className="flex flex-col gap-4" style={{ viewTransitionName: "project-header" }}>
      <div className="flex flex-col gap-1">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/w/${workspace.slug}`} transitionTypes={NAV}>
                  {workspace.name}
                </Link>
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
      <ProjectTabs base={base} />
    </div>
  );
}
