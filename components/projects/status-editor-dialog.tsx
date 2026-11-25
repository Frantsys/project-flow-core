"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { updateProjectStatusesAction } from "@/server/actions/project.actions";
import type { StatusCategory, StatusDTO } from "@/server/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { FieldError } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const CATEGORY_LABEL: Record<StatusCategory, string> = {
  TODO: "A fazer",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluído",
};

// chave local estável para a lista: status novos ainda não têm id
type Row = { key: string; id?: string; name: string; category: StatusCategory };

let nextKey = 0;
const tasks = (n: number) => (n === 1 ? "1 tarefa" : `${n} tarefas`);
const toRows = (statuses: StatusDTO[]): Row[] => statuses.map((s) => ({ key: s.id, ...s }));

/**
 * Edita as colunas do quadro: nome, categoria, ordem, adicionar e remover.
 * A categoria "Concluído" é o que conta como tarefa feita (ao concluir sprints, por exemplo).
 */
export function StatusEditorDialog({
  projectId,
  statuses,
  taskCounts,
  open,
  onOpenChange,
}: {
  projectId: string;
  statuses: StatusDTO[];
  taskCounts: Record<string, number>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => toRows(statuses));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (index: number, delta: number) =>
    setRows((rs) => {
      const copy = [...rs];
      const [row] = copy.splice(index, 1);
      copy.splice(index + delta, 0, row!);
      return copy;
    });

  // para onde vão as tarefas de um status removido (mesma regra do servidor)
  const destination = (removed: StatusDTO) =>
    (rows.find((r) => r.category === removed.category) ?? rows[0])?.name;
  const removed = statuses.filter((s) => !rows.some((r) => r.id === s.id) && (taskCounts[s.id] ?? 0) > 0);

  function onSave() {
    startTransition(async () => {
      const result = await updateProjectStatusesAction({
        projectId,
        statuses: rows.map(({ id, name, category }) => ({ id, name, category })),
      });
      if (!result.success) {
        setError(result.fieldErrors?.statuses?.[0] ?? result.error);
        return;
      }
      setError(null);
      onOpenChange(false);
      toast.success(
        result.data.moved > 0
          ? `Colunas atualizadas. ${tasks(result.data.moved)} ${result.data.moved === 1 ? "mudou" : "mudaram"} de status.`
          : "Colunas atualizadas."
      );
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setRows(toRows(statuses));
        setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Colunas do quadro</DialogTitle>
          <DialogDescription>
            Renomeie, reordene ou crie status. A categoria define o comportamento: tarefas em “Concluído”
            contam como feitas ao concluir uma sprint.
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col gap-2" aria-label="Status do projeto">
          {rows.map((row, index) => (
            <li key={row.key} className="flex items-center gap-2">
              <div className="flex flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Mover ${row.name || "status"} para cima`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Mover ${row.name || "status"} para baixo`}
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </div>
              <Input
                aria-label="Nome do status"
                value={row.name}
                maxLength={40}
                onChange={(e) => update(row.key, { name: e.target.value })}
                className="min-w-0 flex-1"
              />
              <Select
                value={row.category}
                onValueChange={(category) => update(row.key, { category: category as StatusCategory })}
              >
                <SelectTrigger aria-label={`Categoria de ${row.name || "status"}`} className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABEL) as StatusCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
                {row.id ? tasks(taskCounts[row.id] ?? 0) : "novo"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remover ${row.name || "status"}`}
                disabled={rows.length <= 2}
                onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>

        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          disabled={rows.length >= 12}
          onClick={() =>
            setRows((rs) => [...rs, { key: `new-${nextKey++}`, name: "", category: "IN_PROGRESS" }])
          }
        >
          <Plus aria-hidden="true" />
          Adicionar status
        </Button>

        {removed.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-md bg-muted p-3 text-sm" aria-live="polite">
            {removed.map((s) => (
              <li key={s.id}>
                {tasks(taskCounts[s.id] ?? 0)} de “{s.name}” {taskCounts[s.id] === 1 ? "vai" : "vão"} para “
                {destination(s)}”.
              </li>
            ))}
          </ul>
        )}

        <FieldError>{error}</FieldError>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={onSave} disabled={pending}>
            {pending && <Spinner />}
            Salvar colunas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
