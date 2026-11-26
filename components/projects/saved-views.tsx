"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { deleteViewAction, saveViewAction } from "@/server/actions/view.actions";
import { viewQuery, type SavedViewDTO } from "@/lib/saved-views";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Visões salvas: um clique aplica um conjunto de filtros (e o agrupamento). São de cada pessoa;
 * o link da página continua compartilhável porque tudo fica na URL.
 */
export function SavedViews({ projectId, views }: { projectId: string; views: SavedViewDTO[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = viewQuery((k) => params.get(k));
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  if (views.length === 0 && !current) return null;

  const apply = (query: string) =>
    router.replace(query && query !== current ? `${pathname}?${query}` : pathname, { scroll: false });

  function save() {
    startTransition(async () => {
      const result = await saveViewAction({ projectId, name, query: current });
      if (!result.success) return void toast.error(result.error);
      toast.success(`Visão “${result.data.name}” salva.`);
      setSaving(false);
      setName("");
      router.refresh();
    });
  }

  function remove(view: SavedViewDTO) {
    startTransition(async () => {
      const result = await deleteViewAction({ viewId: view.id });
      if (!result.success) return void toast.error(result.error);
      router.refresh();
    });
  }

  const alreadySaved = views.some((v) => v.query === current);

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[13px]" role="group" aria-label="Visões salvas">
      {views.length > 0 && <span className="text-muted-foreground">Visões:</span>}
      {views.map((v) => {
        const active = v.query === current;
        return (
          <span
            key={v.id}
            className={cn(
              "inline-flex h-7 items-center rounded-md border text-[13px]",
              active ? "border-primary bg-primary text-primary-foreground" : "bg-background"
            )}
          >
            <button
              type="button"
              aria-pressed={active}
              onClick={() => apply(active ? "" : v.query)}
              title={active ? "Clique para tirar os filtros" : undefined}
              className="h-full rounded-l-md px-2.5 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {v.name}
            </button>
            <button
              type="button"
              aria-label={`Excluir a visão ${v.name}`}
              disabled={pending}
              onClick={() => remove(v)}
              className="flex h-full items-center rounded-r-md px-1.5 opacity-70 outline-none hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        );
      })}
      {current && !alreadySaved && (
        <Popover open={saving} onOpenChange={setSaving}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7">
              <Plus aria-hidden="true" />
              Salvar filtros atuais
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72">
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) save();
              }}
            >
              <label htmlFor="view-name" className="text-sm font-medium">
                Nome da visão
              </label>
              <Input
                id="view-name"
                autoFocus
                value={name}
                maxLength={40}
                placeholder="Ex.: Bugs urgentes"
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Só você vê. Guarda os filtros e o agrupamento.</p>
              <Button type="submit" size="sm" className="self-end" disabled={!name.trim() || pending}>
                Salvar visão
              </Button>
            </form>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
