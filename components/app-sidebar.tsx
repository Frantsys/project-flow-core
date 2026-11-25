"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, FileText, House, Plus, SlidersHorizontal } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { UserMenu } from "./user-menu";
import { initials, roleLabel } from "@/lib/labels";
import type { CurrentUser } from "@/lib/session";
import type { WorkspaceDTO, WorkspaceSummaryDTO } from "@/server/db/types";

interface AppSidebarProps {
  user: CurrentUser;
  workspace: Pick<WorkspaceDTO, "name" | "slug" | "currentUserRole" | "projects">;
  workspaces: WorkspaceSummaryDTO[];
}

export function AppSidebar({ user, workspace, workspaces }: AppSidebarProps) {
  const pathname = usePathname();
  const base = `/w/${workspace.slug}`;

  const nav = [
    { href: base, label: "Visão geral", icon: House, active: pathname === base },
    {
      href: `${base}/docs`,
      label: "Documentos",
      icon: FileText,
      active: pathname.startsWith(`${base}/docs`),
    },
    {
      href: `${base}/settings`,
      label: "Configurações",
      icon: SlidersHorizontal,
      active: pathname.startsWith(`${base}/settings`),
    },
  ];

  return (
    <Sidebar>
      <SidebarHeader>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="gap-2.5">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                {initials(workspace.name)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold text-foreground">{workspace.name}</span>
                <span className="text-xs text-muted-foreground">{roleLabel[workspace.currentUserRole]}</span>
              </span>
              <ChevronsUpDown className="text-icon-muted" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Trocar de workspace
            </DropdownMenuLabel>
            {workspaces.map((ws) => (
              <DropdownMenuItem key={ws.id} asChild>
                <Link href={`/w/${ws.slug}`}>
                  <span className="flex-1 truncate">{ws.name}</span>
                  {ws.slug === workspace.slug && <Check aria-label="Atual" />}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/workspaces">
                <Plus aria-hidden="true" />
                Ver todos ou criar
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {nav.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={item.active}>
                  <Link href={item.href} aria-current={item.active ? "page" : undefined}>
                    <item.icon aria-hidden="true" />
                    {item.label}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Projetos</SidebarGroupLabel>
          <SidebarMenu>
            {workspace.projects.length === 0 && (
              <p className="px-2 text-[13px] text-muted-foreground">Nenhum projeto ainda.</p>
            )}
            {workspace.projects.map((project) => {
              const href = `${base}/projects/${project.key}`;
              const active = pathname.startsWith(href);
              return (
                <SidebarMenuItem key={project.id}>
                  <SidebarMenuButton asChild isActive={active}>
                    <Link href={href} aria-current={active ? "page" : undefined}>
                      <Badge variant="outline" className="h-5 px-1.5 text-[11px]">
                        {project.key}
                      </Badge>
                      <span className="truncate">{project.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserMenu user={user} showName />
      </SidebarFooter>
    </Sidebar>
  );
}
