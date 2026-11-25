"use client";

import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { TaskDetail, type TaskDetailProps } from "./task-detail";

/** Painel lateral aberto pela rota interceptada: fechar volta para a tela de onde veio. */
export function TaskSheet({ title, ...props }: TaskDetailProps & { title: string }) {
  const router = useRouter();

  return (
    <Sheet open onOpenChange={(open) => !open && router.back()}>
      <SheetContent showCloseButton={false} className="flex w-full flex-col gap-0 p-0 sm:max-w-[640px]">
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <SheetDescription className="sr-only">Detalhes, subtarefas e comentários da tarefa</SheetDescription>
        <TaskDetail {...props} onClose={() => router.back()} />
      </SheetContent>
    </Sheet>
  );
}
