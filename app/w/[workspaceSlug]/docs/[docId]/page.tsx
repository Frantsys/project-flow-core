import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDocuments, getWorkspace, requireUser } from "@/lib/session";
import { getDocument } from "@/server/services/document.service";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentEditor } from "@/components/docs/document-editor";

export default function DocumentPage({ params }: PageProps<"/w/[workspaceSlug]/docs/[docId]">) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96 flex-1" />}>
      <DocumentView params={params} />
    </Suspense>
  );
}

async function DocumentView({ params }: { params: Promise<{ workspaceSlug: string; docId: string }> }) {
  const { workspaceSlug, docId } = await params;
  const user = await requireUser();
  const [workspace, documents, doc] = await Promise.all([
    getWorkspace(workspaceSlug, user.id),
    getDocuments(workspaceSlug, user.id),
    getDocument(workspaceSlug, docId, user.id),
  ]);
  if (!workspace || !documents || !doc) notFound();

  const byId = new Map(documents.map((d) => [d.id, d]));

  // trilha: sobe pelos pais até a raiz (com limite, caso algum dado venha com ciclo)
  const ancestors: { id: string; title: string }[] = [];
  for (let p = doc.parentId ? byId.get(doc.parentId) : undefined; p && ancestors.length < 20; p = p.parentId ? byId.get(p.parentId) : undefined) {
    ancestors.unshift({ id: p.id, title: p.title });
  }

  // subdocumentos que a exclusão vai levar junto
  let childCount = 0;
  const stack = [doc.id];
  while (stack.length) {
    const id = stack.pop();
    for (const d of documents) {
      if (d.parentId === id) {
        childCount++;
        stack.push(d.id);
      }
    }
  }

  return (
    // key: trocar de documento recria o editor, em vez de herdar o texto do anterior
    <DocumentEditor
      key={doc.id}
      doc={doc}
      workspace={{ id: workspace.id, slug: workspace.slug }}
      ancestors={ancestors}
      childCount={childCount}
    />
  );
}
