import { Suspense } from "react";
import { TaskDetailLoader } from "@/components/tasks/task-detail-loader";

/** Tarefa aberta a partir do quadro ou do backlog: painel lateral por cima da tela atual. */
export default function TaskSheetPage({
  params,
}: PageProps<"/w/[workspaceSlug]/projects/[projectKey]/tasks/[code]">) {
  return (
    <Suspense>
      <TaskDetailLoader params={params} variant="sheet" />
    </Suspense>
  );
}
