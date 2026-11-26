"use client";

import { useEffect, useId, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListFilter, Search, X } from "lucide-react";
import { hasFilters, parseTaskFilters } from "@/lib/task-filters";
import { GROUP_OPTIONS, parseGroupBy } from "@/lib/board-lanes";
import type { SavedViewDTO } from "@/lib/saved-views";
import { SavedViews } from "./saved-views";
import { priorityBadge, typeLabel } from "@/lib/labels";
import type { TaskPriority, TaskType, WorkspaceMemberDTO } from "@/server/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";
const PRIORITIES: TaskPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];
const TYPES: TaskType[] = ["TASK", "BUG", "STORY"];

/**
 * Barra de filtros; o estado fica na URL (?q=&assignee=&priority=&type=&tag=).
 * No celular só a busca fica à vista; os outros filtros abrem no botão "Filtros", que conta os ativos.
 */
export function TaskFilterBar({
  members,
  tags = [],
  grouping = false,
  projectId,
  views = [],
}: {
  members: Pick<WorkspaceMemberDTO, "id" | "name">[];
  /** Etiquetas usadas no projeto; sem nenhuma, o filtro de etiqueta não aparece. */
  tags?: string[];
  /** Mostra "Agrupar" (só o quadro tem faixas). */
  grouping?: boolean;
  /** Com o projeto, mostra as visões salvas da pessoa. */
  projectId?: string;
  views?: SavedViewDTO[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = parseTaskFilters((k) => params.get(k));
  const [q, setQ] = useState(filters.q);
  // a busca mudou por fora (visão salva, limpar): o campo acompanha
  const [lastQ, setLastQ] = useState(filters.q);
  if (filters.q !== lastQ) {
    setLastQ(filters.q);
    setQ(filters.q);
  }
  const groupBy = parseGroupBy(params.get("group"));
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const active = [filters.assignee, filters.priority, filters.type, filters.tag].filter(Boolean).length;

  function set(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value && value !== ALL) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  // texto: espera a pessoa parar de digitar antes de atualizar a URL
  useEffect(() => {
    if (q.trim() === filters.q) return;
    const timer = setTimeout(() => set("q", q.trim() || null), 250);
    return () => clearTimeout(timer);
  });

  return (
    <div className="flex flex-col gap-2">
      {projectId && <SavedViews projectId={projectId} views={views} />}
      <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Filtrar tarefas">
        <div className="relative min-w-36 flex-1 sm:w-60 sm:flex-none">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Buscar por código ou título"
            placeholder="Buscar tarefas"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          className="sm:hidden"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          <ListFilter aria-hidden="true" />
          Filtros
          {active > 0 && (
            <span className="rounded-sm bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">
              <span className="sr-only">, </span>
              {active}
              <span className="sr-only"> {active === 1 ? "ativo" : "ativos"}</span>
            </span>
          )}
        </Button>
        {/* no celular é um painel que abre e fecha; do sm para cima os filtros ficam na própria barra */}
        <div id={panelId} className={open ? "flex w-full flex-wrap gap-2 sm:contents" : "hidden sm:contents"}>
          <Select value={filters.assignee ?? ALL} onValueChange={(v) => set("assignee", v)}>
            <SelectTrigger aria-label="Responsável" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os responsáveis</SelectItem>
              <SelectItem value="me">Minhas tarefas</SelectItem>
              <SelectItem value="none">Sem responsável</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.priority ?? ALL} onValueChange={(v) => set("priority", v)}>
            <SelectTrigger aria-label="Prioridade" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toda prioridade</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {priorityBadge[p].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.type ?? ALL} onValueChange={(v) => set("type", v)}>
            <SelectTrigger aria-label="Tipo" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todo tipo</SelectItem>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {typeLabel[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(tags.length > 0 || filters.tag) && (
            <Select value={filters.tag ?? ALL} onValueChange={(v) => set("tag", v)}>
              <SelectTrigger aria-label="Etiqueta" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toda etiqueta</SelectItem>
                {/* etiqueta vinda do link que já não está em nenhuma tarefa continua selecionável */}
                {(filters.tag && !tags.includes(filters.tag) ? [filters.tag, ...tags] : tags).map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {hasFilters(filters) && (
          <Button
            variant="ghost"
            title="Limpar filtros"
            onClick={() => {
              setQ("");
              router.replace(groupBy ? `${pathname}?group=${groupBy}` : pathname, { scroll: false });
            }}
          >
            <X aria-hidden="true" />
            {/* no celular só o ícone, para a busca não ficar espremida */}
            <span className="sr-only sm:not-sr-only">Limpar filtros</span>
          </Button>
        )}
        {grouping && (
          <Select value={groupBy ?? "none"} onValueChange={(v) => set("group", v === "none" ? null : v)}>
            <SelectTrigger aria-label="Agrupar o quadro" className="w-48 sm:ml-auto">
              <span className="text-muted-foreground">Agrupar:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem faixas</SelectItem>
              {(Object.keys(GROUP_OPTIONS) as (keyof typeof GROUP_OPTIONS)[]).map((g) => (
                <SelectItem key={g} value={g}>
                  {GROUP_OPTIONS[g]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
