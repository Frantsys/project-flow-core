import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDocuments, getWorkspace, requireUser } from "@/lib/session";
import { Skeleton } from "@/components/ui/skeleton";
import { DocTree } from "@/components/docs/doc-tree";

export default function DocsLayout({ children, params }: LayoutProps<"/w/[workspaceSlug]/docs">) {
  return (
    <div data-full-height className="flex min-h-svh flex-wrap">
      <aside className="flex-[1_1_240px] border-b md:max-w-[280px] md:border-r md:border-b-0">
        <Suspense fallback={<TreeSkeleton />}>
          <Tree params={params} />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-[999_1_420px]">{children}</div>
    </div>
  );
}

async function Tree({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const [workspace, documents] = await Promise.all([
    getWorkspace(workspaceSlug, user.id),
    getDocuments(workspaceSlug, user.id),
  ]);
  if (!workspace || !documents) notFound();

  return (
    <DocTree
      workspace={{ id: workspace.id, slug: workspace.slug }}
      projects={workspace.projects}
      documents={documents}
    />
  );
}

function TreeSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3" aria-hidden="true">
      <Skeleton className="h-7" />
      <Skeleton className="h-8" />
      <Skeleton className="h-8" />
      <Skeleton className="h-8" />
    </div>
  );
}
