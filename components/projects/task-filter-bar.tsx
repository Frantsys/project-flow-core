"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { hasFilters, parseTaskFilters } from "@/lib/task-filters";
import { priorityBadge, typeLabel } from "@/lib/labels";
import type { TaskPriority, TaskType, WorkspaceMemberDTO } from "@/server/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";
const PRIORITIES: TaskPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];
const TYPES: TaskType[] = ["TASK", "BUG", "STORY"];

/** Barra de filtros; o estado fica na URL (?q=&assignee=&priority=&type=). */
export function TaskFilterBar({ members }: { members: Pick<WorkspaceMemberDTO, "id" | "name">[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = parseTaskFilters((k) => params.get(k));
  const [q, setQ] = useState(filters.q);

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
    <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Filtrar tarefas">
      <div className="relative w-full sm:w-60">
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
      {hasFilters(filters) && (
        <Button
          variant="ghost"
          onClick={() => {
            setQ("");
            router.replace(pathname, { scroll: false });
          }}
        >
          <X aria-hidden="true" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
