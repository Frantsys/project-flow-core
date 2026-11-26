import { Suspense } from "react";
import { Reveal } from "@/components/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskDetailLoader } from "@/components/tasks/task-detail-loader";

/** Tarefa aberta por link direto ou recarregando a página: tela própria. */
export default function TaskPage({
  params,
}: PageProps<"/w/[workspaceSlug]/projects/[projectKey]/tasks/[code]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col p-0 md:p-6">
      <div className="flex min-h-[70svh] flex-col overflow-hidden border bg-card md:rounded-xl">
        <Suspense fallback={<Skeleton className="m-5 h-96" />}>
          <Reveal>
            <TaskDetailLoader params={params} variant="page" />
          </Reveal>
        </Suspense>
      </div>
    </div>
  );
}
