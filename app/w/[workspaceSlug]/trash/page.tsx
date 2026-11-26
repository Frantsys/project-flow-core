import { Suspense } from "react";
import { Reveal } from "@/components/reveal";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { getWorkspace, requireUser } from "@/lib/session";
import { getTrash } from "@/server/services/trash.service";
import { TRASH_DAYS } from "@/server/db/models";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { TrashList } from "@/components/workspaces/trash-list";

export const metadata: Metadata = { title: "Lixeira" };

export default function TrashPage({ params }: PageProps<"/w/[workspaceSlug]/trash">) {
  return (
    <div className="flex max-w-[860px] flex-col gap-5 p-6 md:p-8">
      <div>
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Lixeira</h1>
        <p className="text-sm text-muted-foreground">
          Tarefas e documentos excluídos ficam aqui por {TRASH_DAYS} dias e depois somem de vez.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-60 rounded-xl" />}>
        <Reveal>
          <Trash params={params} />
        </Reveal>
      </Suspense>
    </div>
  );
}

async function Trash({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const workspace = await getWorkspace(workspaceSlug, user.id);
  if (!workspace) notFound();
  const items = await getTrash(workspace.id, user.id);
  if (!items) notFound();

  if (items.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Trash2 aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>A lixeira está vazia</EmptyTitle>
          <EmptyDescription>
            Quando alguém excluir uma tarefa ou um documento, ele aparece aqui.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return <TrashList items={items} />;
}
