import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getWorkspace, requireUser } from "@/lib/session";
import { getProjectByKey } from "@/server/services/project.service";
import { projectMetrics } from "@/lib/project-metrics";
import { fullDate } from "@/lib/labels";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectHeader } from "@/components/projects/project-header";
import { BarList, ChartCard, ColumnChart, Meter, StatTile } from "@/components/reports/charts";

export default function ReportsPage({
  params,
}: PageProps<"/w/[workspaceSlug]/projects/[projectKey]/reports">) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-[560px] rounded-xl" />}>
      <Reports params={params} />
    </Suspense>
  );
}

const todayInBrazil = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

async function Reports({ params }: { params: Promise<{ workspaceSlug: string; projectKey: string }> }) {
  const { workspaceSlug, projectKey } = await params;
  const user = await requireUser();
  const [workspace, project] = await Promise.all([
    getWorkspace(workspaceSlug, user.id),
    getProjectByKey(workspaceSlug, projectKey, user.id),
  ]);
  if (!workspace || !project) notFound();

  const m = projectMetrics(project, todayInBrazil());
  const tasks: [string, string] = ["tarefa", "tarefas"];

  return (
    <div className="flex min-w-0 flex-col gap-5 p-6 md:p-8">
      <ProjectHeader workspace={workspace} project={project} view="reports" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Tarefas abertas" value={m.open} hint={`de ${m.total} no projeto`} />
        <StatTile
          label="Concluídas"
          value={m.done}
          hint={m.total ? `${Math.round((m.done / m.total) * 100)}% do total` : undefined}
        />
        <StatTile label="Atrasadas" value={m.overdue} hint="abertas com prazo vencido" />
        <StatTile
          label="Sprint ativa"
          value={m.activeSprint ? `${m.activeSprint.donePoints}/${m.activeSprint.totalPoints}` : "—"}
          hint={m.activeSprint ? `pontos em ${m.activeSprint.name}` : "nenhuma sprint em andamento"}
        />
      </div>

      {m.activeSprint && (
        <ChartCard
          title={`Progresso da ${m.activeSprint.name}`}
          description={m.activeSprint.endDate ? `Termina em ${fullDate(m.activeSprint.endDate)}.` : undefined}
        >
          <div className="flex flex-col gap-4">
            <Meter
              label="Tarefas concluídas"
              value={m.activeSprint.doneTasks}
              total={m.activeSprint.totalTasks}
            />
            <Meter
              label="Pontos concluídos"
              value={m.activeSprint.donePoints}
              total={m.activeSprint.totalPoints}
            />
          </div>
        </ChartCard>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Tarefas por status" description="Todas as tarefas, na ordem das colunas do quadro.">
          <BarList data={m.byStatus} unit={tasks} empty="Nenhuma tarefa ainda." />
        </ChartCard>
        <ChartCard title="Velocidade" description="Pontos concluídos nas últimas sprints encerradas.">
          <ColumnChart
            data={m.velocity}
            unit="pontos"
            empty="Conclua uma sprint para ver a velocidade do time."
          />
        </ChartCard>
        <ChartCard title="Abertas por responsável" description="Quem está com mais trabalho em andamento.">
          <BarList data={m.byAssignee} unit={tasks} empty="Nenhuma tarefa aberta." />
        </ChartCard>
        <ChartCard title="Abertas por prioridade">
          <BarList data={m.byPriority} unit={tasks} empty="Nenhuma tarefa aberta." />
        </ChartCard>
      </div>
    </div>
  );
}
