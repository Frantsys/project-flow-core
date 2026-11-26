"use client";

import { Fragment } from "react";
import { NAV } from "@/lib/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, FileText, House, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { CommandMenuButton } from "./command-menu";
import { NotificationBell } from "./notification-bell";
import { MyWorkPanel } from "./my-work-panel";
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
    { href: `${base}/trash`, label: "Lixeira", icon: Trash2, active: pathname === `${base}/trash` },
  ];

  return (
    <Sidebar style={{ viewTransitionName: "app-sidebar" }}>
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
                <Link href={`/w/${ws.slug}`} transitionTypes={NAV}>
                  <span className="flex-1 truncate">{ws.name}</span>
                  {ws.slug === workspace.slug && <Check aria-label="Atual" />}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/workspaces" transitionTypes={NAV}>
                <Plus aria-hidden="true" />
                Ver todos ou criar
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex gap-2">
          <CommandMenuButton className="min-w-0 flex-1 justify-start" />
          <NotificationBell />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {nav.map((item, i) => (
              <Fragment key={item.href}>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={item.active} className={PILL_BUTTON}>
                    <Link
                      href={item.href}
                      transitionTypes={NAV}
                      aria-current={item.active ? "page" : undefined}
                    >
                      {item.active && <ActivePill />}
                      <item.icon aria-hidden="true" />
                      {item.label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {/* logo depois de Visão geral: Minhas tarefas abre por cima da página */}
                {i === 0 && (
                  <SidebarMenuItem>
                    <MyWorkPanel workspaceSlug={workspace.slug} />
                  </SidebarMenuItem>
                )}
              </Fragment>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Projetos</SidebarGroupLabel>
          <SidebarMenu>
            {workspace.projects.length === 0 && (
              // dentro de um item: o SidebarMenu é uma <ul>
              <SidebarMenuItem>
                <p className="px-2 text-[13px] text-muted-foreground">Nenhum projeto ainda.</p>
              </SidebarMenuItem>
            )}
            {workspace.projects.map((project) => {
              const href = `${base}/projects/${project.key}`;
              const active = pathname.startsWith(href);
              return (
                <SidebarMenuItem key={project.id}>
                  <SidebarMenuButton asChild isActive={active} className={PILL_BUTTON}>
                    <Link href={href} transitionTypes={NAV} aria-current={active ? "page" : undefined}>
                      {active && <ActivePill />}
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

// o fundo do item ativo é uma peça à parte, que desliza entre os itens na troca de tela
// (globals.css, nav-active); o texto fica no lugar
const PILL_BUTTON = "relative isolate data-active:bg-transparent";

function ActivePill() {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 -z-10 rounded-md bg-sidebar-accent"
      style={{ viewTransitionName: "nav-active" }}
    />
  );
}
