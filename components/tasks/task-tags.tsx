"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { tagColor } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export function TagChip({
  tag,
  className,
  children,
}: {
  tag: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-0.5 rounded-sm px-1.5 text-xs font-medium",
        tagColor(tag),
        className
      )}
    >
      {tag}
      {children}
    </span>
  );
}

/**
 * Etiquetas da tarefa: Enter (ou vírgula) adiciona o que foi digitado, o X remove. As já usadas
 * no projeto aparecem como sugestão do navegador (datalist).
 */
export function TagsEditor({
  id,
  tags,
  suggestions,
  onChange,
  disabled,
}: {
  id: string;
  tags: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const has = (t: string) => tags.some((x) => x.toLocaleLowerCase("pt-BR") === t.toLocaleLowerCase("pt-BR"));

  function add() {
    const tag = draft.trim().slice(0, 30);
    setDraft("");
    if (tag && !has(tag) && tags.length < 10) onChange([...tags, tag]);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <TagChip key={tag} tag={tag}>
          <button
            type="button"
            className="-mr-1 rounded-sm p-0.5 hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={`Remover etiqueta ${tag}`}
            disabled={disabled}
            onClick={() => onChange(tags.filter((t) => t !== tag))}
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </TagChip>
      ))}
      {tags.length < 10 && (
        <>
          <Input
            id={id}
            value={draft}
            list={listId}
            maxLength={30}
            placeholder={tags.length ? "Adicionar" : "Adicionar etiqueta"}
            className="h-7 w-36 text-[13px]"
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value.replace(",", ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add();
              }
            }}
            onBlur={add}
          />
          <datalist id={listId}>
            {suggestions
              .filter((s) => !has(s))
              .map((s) => (
                <option key={s} value={s} />
              ))}
          </datalist>
        </>
      )}
    </div>
  );
}
