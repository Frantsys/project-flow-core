"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import {
  addAiSubtasksAction,
  suggestSubtasksAction,
  summarizeTaskAction,
} from "@/server/actions/task.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";

/** Resumo da tarefa feito pela IA: aparece para todo o time e pode ser refeito a qualquer momento. */
export function AiSummary({ taskId, summary }: { taskId: string; summary: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function summarize() {
    startTransition(async () => {
      const result = await summarizeTaskAction({ taskId });
      if (!result.success) return void toast.error(result.error);
      router.refresh();
    });
  }

  return (
    <section
      className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3"
      aria-labelledby="sec-ai-summary"
      aria-busy={pending}
    >
      <div className="flex items-center gap-2">
        <h3 id="sec-ai-summary" className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-4 text-info-fg" aria-hidden="true" />
          Resumo da IA
        </h3>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={summarize} disabled={pending}>
          {pending && <Spinner />}
          {summary ? "Atualizar resumo" : "Resumir com IA"}
        </Button>
      </div>
      <p className="text-sm leading-relaxed text-text-secondary" aria-live="polite">
        {summary ?? "Gera um resumo da descrição, das subtarefas e dos comentários."}
      </p>
    </section>
  );
}

/** Sugestões de subtarefas: a IA propõe, a pessoa escolhe quais entram. */
export function AiSubtaskSuggestions({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  function suggest() {
    startTransition(async () => {
      const result = await suggestSubtasksAction({ taskId });
      if (!result.success) return void toast.error(result.error);
      setSuggestions(result.data.subtasks);
      setChosen(new Set(result.data.subtasks));
      if (result.data.subtasks.length === 0) toast.info("A IA não encontrou subtarefas novas.");
    });
  }

  function add() {
    startTransition(async () => {
      const result = await addAiSubtasksAction({ taskId, titles: [...chosen] });
      if (!result.success) return void toast.error(result.error);
      toast.success(
        result.data.added === 1 ? "1 subtarefa adicionada." : `${result.data.added} subtarefas adicionadas.`
      );
      setSuggestions(null);
      router.refresh();
    });
  }

  if (!suggestions?.length) {
    return (
      <Button size="sm" variant="ghost" className="self-start" onClick={suggest} disabled={pending}>
        {pending ? <Spinner /> : <Sparkles aria-hidden="true" />}
        Sugerir subtarefas com IA
      </Button>
    );
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold">
        <Sparkles className="size-4 text-info-fg" aria-hidden="true" />
        Sugestões da IA
      </legend>
      {suggestions.map((s) => (
        <label key={s} className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={chosen.has(s)}
            onCheckedChange={(on) =>
              setChosen((prev) => {
                const next = new Set(prev);
                if (on === true) next.add(s);
                else next.delete(s);
                return next;
              })
            }
          />
          {s}
          <Badge variant="info" className="ml-auto">
            IA
          </Badge>
        </label>
      ))}
      <div className="flex gap-2">
        <Button size="sm" onClick={add} disabled={pending || chosen.size === 0}>
          {pending && <Spinner />}
          Adicionar selecionadas
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSuggestions(null)}>
          Descartar
        </Button>
      </div>
    </fieldset>
  );
}
