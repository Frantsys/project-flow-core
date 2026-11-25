"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { NewDocumentButton } from "./new-document-button";
import type { DocumentSummaryDTO } from "@/server/db/types";

interface DocTreeProps {
  workspace: { id: string; slug: string };
  projects: { id: string; key: string; name: string }[];
  documents: DocumentSummaryDTO[];
}

/** Árvore de documentos: os gerais do workspace e um grupo por projeto, aninhados por documento pai. */
export function DocTree({ workspace, projects, documents }: DocTreeProps) {
  const pathname = usePathname();
  const [filter, setFilter] = useState("");
  const activeId = pathname.split("/docs/")[1]?.split("/")[0];

  const byParent = new Map<string | null, DocumentSummaryDTO[]>();
  for (const doc of documents) {
    const list = byParent.get(doc.parentId) ?? [];
    list.push(doc);
    byParent.set(doc.parentId, list);
  }

  const query = filter.trim().toLowerCase();
  const matches = query ? documents.filter((d) => d.title.toLowerCase().includes(query)) : null;

  const groups = [
    { key: "workspace", label: "Workspace", projectId: null as string | null },
    ...projects.map((p) => ({ key: p.id, label: `${p.key} · ${p.name}`, projectId: p.id as string | null })),
  ];

  return (
    <nav aria-label="Documentos" className="flex flex-col gap-1 p-3">
      <div className="flex items-center justify-between px-1 pb-2">
        <h2 className="text-sm font-semibold">Documentos</h2>
        <NewDocumentButton workspaceId={workspace.id} workspaceSlug={workspace.slug} variant="ghost" size="icon-sm" aria-label="Novo documento">
          <Plus aria-hidden="true" />
        </NewDocumentButton>
      </div>
      <label htmlFor="doc-filter" className="sr-only">
        Filtrar documentos
      </label>
      <Input
        id="doc-filter"
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar documentos…"
        className="mb-2 h-8 text-[13px]"
      />

      {matches ? (
        matches.length === 0 ? (
          <p className="px-2 text-[13px] text-muted-foreground">Nenhum documento com esse título.</p>
        ) : (
          matches.map((doc) => <DocLink key={doc.id} doc={doc} slug={workspace.slug} active={doc.id === activeId} depth={0} />)
        )
      ) : (
        groups.map((group) => {
          const roots = (byParent.get(null) ?? []).filter((d) => d.projectId === group.projectId);
          if (group.projectId && roots.length === 0) return null;
          return (
            <div key={group.key} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between px-2 pt-3 pb-1">
                <span className="truncate text-xs font-medium text-muted-foreground">{group.label}</span>
                {group.projectId && (
                  <NewDocumentButton
                    workspaceId={workspace.id}
                    workspaceSlug={workspace.slug}
                    projectId={group.projectId}
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Novo documento em ${group.label}`}
                  >
                    <Plus aria-hidden="true" />
                  </NewDocumentButton>
                )}
              </div>
              {roots.length === 0 ? (
                <p className="px-2 text-[13px] text-muted-foreground">Nenhum documento ainda.</p>
              ) : (
                roots.map((doc) => (
                  <DocNode key={doc.id} doc={doc} byParent={byParent} slug={workspace.slug} activeId={activeId} depth={0} />
                ))
              )}
            </div>
          );
        })
      )}
    </nav>
  );
}

function DocNode({
  doc,
  byParent,
  slug,
  activeId,
  depth,
}: {
  doc: DocumentSummaryDTO;
  byParent: Map<string | null, DocumentSummaryDTO[]>;
  slug: string;
  activeId?: string;
  depth: number;
}) {
  const children = byParent.get(doc.id) ?? [];
  const [open, setOpen] = useState(true);

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center">
        {children.length > 0 ? (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={open ? `Recolher ${doc.title}` : `Expandir ${doc.title}`}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            style={{ marginLeft: depth * 14 }}
          >
            <ChevronRight aria-hidden="true" className={cn("transition-transform", open && "rotate-90")} />
          </Button>
        ) : (
          <span className="size-6 shrink-0" style={{ marginLeft: depth * 14 }} />
        )}
        <DocLink doc={doc} slug={slug} active={doc.id === activeId} depth={0} />
      </div>
      {open &&
        children.map((child) => (
          <DocNode key={child.id} doc={child} byParent={byParent} slug={slug} activeId={activeId} depth={depth + 1} />
        ))}
    </div>
  );
}

function DocLink({ doc, slug, active, depth }: { doc: DocumentSummaryDTO; slug: string; active: boolean; depth: number }) {
  return (
    <Link
      href={`/w/${slug}/docs/${doc.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-sm text-badge-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active && "bg-accent font-medium text-foreground"
      )}
      style={depth ? { marginLeft: depth * 14 } : undefined}
    >
      <FileText aria-hidden="true" className="size-4 shrink-0 text-icon-muted" />
      <span className="truncate">{doc.title}</span>
    </Link>
  );
}
