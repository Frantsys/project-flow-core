import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { getDocuments, getWorkspace, requireUser } from "@/lib/session";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { NewDocumentButton } from "@/components/docs/new-document-button";

export const metadata: Metadata = { title: "Documentos" };

export default function DocsIndexPage({ params }: PageProps<"/w/[workspaceSlug]/docs">) {
  return (
    <Suspense>
      <DocsIndex params={params} />
    </Suspense>
  );
}

async function DocsIndex({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const [workspace, documents] = await Promise.all([
    getWorkspace(workspaceSlug, user.id),
    getDocuments(workspaceSlug, user.id),
  ]);
  if (!workspace || !documents) notFound();

  const empty = documents.length === 0;

  return (
    <Empty className="m-6 border md:m-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileText aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{empty ? "Nenhum documento ainda" : "Escolha um documento"}</EmptyTitle>
        <EmptyDescription>
          {empty
            ? "Guarde aqui decisões, processos e guias do time. Documentos podem ter subdocumentos."
            : "Abra um documento na lista ao lado ou crie um novo."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <NewDocumentButton workspaceId={workspace.id} workspaceSlug={workspace.slug}>
          Novo documento
        </NewDocumentButton>
      </EmptyContent>
    </Empty>
  );
}
