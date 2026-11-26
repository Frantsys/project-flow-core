import type { TaskPriority, TaskType } from "@/server/db/types";

export interface MyTaskDTO {
  id: string;
  code: string;
  title: string;
  type: TaskType;
  priority: TaskPriority;
  status: string;
  /** "AAAA-MM-DD" ou null. */
  dueDate: string | null;
  project: { name: string; key: string };
  workspace: { name: string; slug: string };
  href: string;
}

/** Agrupa por prazo em relação a `today` ("AAAA-MM-DD"). */
export function groupByDue(tasks: MyTaskDTO[], today: string) {
  const week = new Date(`${today}T00:00:00Z`);
  week.setUTCDate(week.getUTCDate() + 7);
  const weekEnd = week.toISOString().slice(0, 10);
  const groups = [
    { id: "overdue", label: "Atrasadas", tasks: [] as MyTaskDTO[] },
    { id: "today", label: "Hoje", tasks: [] as MyTaskDTO[] },
    { id: "week", label: "Próximos 7 dias", tasks: [] as MyTaskDTO[] },
    { id: "later", label: "Depois", tasks: [] as MyTaskDTO[] },
    { id: "none", label: "Sem prazo", tasks: [] as MyTaskDTO[] },
  ];
  for (const t of tasks) {
    const i = !t.dueDate ? 4 : t.dueDate < today ? 0 : t.dueDate === today ? 1 : t.dueDate <= weekEnd ? 2 : 3;
    groups[i]!.tasks.push(t);
  }
  return groups.filter((g) => g.tasks.length > 0);
}
