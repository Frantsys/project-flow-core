import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { AppSidebar } from "@/components/app-sidebar";
import { Logo } from "@/components/logo";
import { DemoBanner } from "@/components/demo-banner";
import { Buddy } from "@/components/buddy";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { aiEnabled } from "@/server/lib/ai";
import { getWorkspace, requireUser } from "@/lib/session";
import { getUserWorkspaces } from "@/server/services/workspace.service";

export default function WorkspaceLayout({ children, params }: LayoutProps<"/w/[workspaceSlug]">) {
  return (
    <SidebarProvider>
      {/* A sessão e o workspace são da requisição: a sidebar chega por streaming sem segurar a página */}
      <Suspense fallback={<SidebarSkeleton />}>
        <WorkspaceSidebar params={params} />
      </Suspense>
      {/* min-w-0: sem isso o quadro largo estica a página inteira em vez de rolar dentro dele */}
      {/* pb-20: o fim de cada página rola para cima do botão flutuante do assistente; as telas
          de altura cheia (documentos) já deixam espaço e não rolam por causa dele */}
      <SidebarInset className="min-w-0 pb-20 has-data-full-height:pb-0">
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger aria-label="Abrir menu" />
          <Logo />
        </header>
        <Suspense fallback={null}>
          <DemoNotice />
        </Suspense>
        {children}
      </SidebarInset>
      <Suspense fallback={null}>
        <BuddyGate />
      </Suspense>
      <Suspense fallback={null}>
        <KeyboardShortcuts />
      </Suspense>
    </SidebarProvider>
  );
}

async function WorkspaceSidebar({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const [workspace, workspaces] = await Promise.all([
    getWorkspace(workspaceSlug, user.id),
    getUserWorkspaces(user.id),
  ]);

  if (!workspace) notFound();

  return <AppSidebar user={user} workspace={workspace} workspaces={workspaces} />;
}

async function DemoNotice() {
  const user = await requireUser();
  return user.isDemo ? <DemoBanner /> : null;
}

/** O assistente só aparece com a IA configurada e fora da demonstração (que não usa a IA). */
async function BuddyGate() {
  const user = await requireUser();
  return aiEnabled() && !user.isDemo ? <Buddy /> : null;
}

function SidebarSkeleton() {
  return (
    <div
      className="hidden w-(--sidebar-width) shrink-0 flex-col gap-3 border-r bg-sidebar p-3 md:flex"
      aria-hidden="true"
    >
      <Skeleton className="h-12" />
      <Skeleton className="h-8" />
      <Skeleton className="h-8" />
      <Skeleton className="mt-4 h-8" />
    </div>
  );
}
