import Link from "next/link";
import { CircleCheck, Circle } from "lucide-react";
import type { OnboardingStep } from "@/server/services/onboarding.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Meter } from "@/components/reports/charts";

const STEPS: Record<OnboardingStep["id"], { label: string; hint: string; href: (slug: string) => string }> = {
  project: {
    label: "Criar o primeiro projeto",
    hint: "Um projeto tem quadro, backlog e sprints próprios.",
    href: (slug) => `/w/${slug}`,
  },
  task: {
    label: "Criar uma tarefa",
    hint: "Use o + de uma coluna do quadro.",
    href: (slug) => `/w/${slug}`,
  },
  invite: {
    label: "Convidar alguém do time",
    hint: "O convite chega por e-mail e vale por 7 dias.",
    href: (slug) => `/w/${slug}/settings?tab=membros`,
  },
  doc: {
    label: "Escrever um documento",
    hint: "Processos, atas e decisões, em Markdown.",
    href: (slug) => `/w/${slug}/docs`,
  },
};

/** Primeiros passos do workspace. Some sozinho quando tudo foi feito. */
export function OnboardingChecklist({
  steps,
  workspaceSlug,
}: {
  steps: OnboardingStep[];
  workspaceSlug: string;
}) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold">Primeiros passos</CardTitle>
        <CardDescription>Deixe o workspace pronto para o time trabalhar.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Meter label="Concluído" value={done} total={steps.length} />
        <ul className="grid gap-2 sm:grid-cols-2">
          {steps.map((s) => {
            const step = STEPS[s.id];
            const Icon = s.done ? CircleCheck : Circle;
            return (
              <li key={s.id}>
                <Link
                  href={step.href(workspaceSlug)}
                  className="flex gap-3 rounded-md border p-3 text-sm outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Icon
                    className={
                      s.done
                        ? "mt-0.5 size-4 shrink-0 text-success-fg"
                        : "mt-0.5 size-4 shrink-0 text-muted-foreground"
                    }
                    aria-hidden="true"
                  />
                  <span>
                    <span
                      className={s.done ? "block text-muted-foreground line-through" : "block font-medium"}
                    >
                      {step.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.done ? "Feito" : step.hint}
                      <span className="sr-only">{s.done ? "" : " (pendente)"}</span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
