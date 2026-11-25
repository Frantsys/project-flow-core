import Link from "next/link";
import type { Metadata } from "next";
import { Bell, ChartColumn, FileText, Keyboard, ShieldCheck, SquareKanban, UsersRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { DemoButton } from "@/components/demo-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: { absolute: "Project Flow · Gestão de projetos para times pequenos" },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

const FEATURES = [
  {
    icon: SquareKanban,
    title: "Quadro, lista e calendário",
    text: "Arraste tarefas entre colunas que você mesmo define, ordene em lista ou veja os prazos do mês.",
  },
  {
    icon: ChartColumn,
    title: "Sprints e relatórios",
    text: "Planeje sprints no backlog, acompanhe o progresso e a velocidade do time sem planilha.",
  },
  {
    icon: FileText,
    title: "Documentos do time",
    text: "Processos, atas e decisões em Markdown, organizados em árvore junto dos projetos.",
  },
  {
    icon: Bell,
    title: "Menções e notificações",
    text: "Mencione alguém com @ num comentário e a pessoa é avisada no sino e por e-mail.",
  },
  {
    icon: Keyboard,
    title: "Rápido no teclado",
    text: "Ctrl K busca qualquer tarefa, projeto ou documento e leva você até ele.",
  },
  {
    icon: ShieldCheck,
    title: "Seguro por padrão",
    text: "Papéis por workspace, convites por e-mail com link único e limite de tentativas no login.",
  },
];

const STEPS = [
  { title: "Crie um workspace", text: "Um espaço para o time, com dono, admins e membros." },
  { title: "Convide as pessoas", text: "Cada uma recebe um link por e-mail e entra com o papel certo." },
  { title: "Organize o trabalho", text: "Projetos com quadro, sprints e documentos, tudo no mesmo lugar." },
];

// prévia estática do quadro: mostra o produto sem depender de imagem
const PREVIEW = [
  {
    name: "A Fazer",
    cards: [
      { code: "PF-12", title: "Notificações de menção", tag: "Média" },
      { code: "PF-14", title: "Exportar tarefas em CSV", tag: "Baixa" },
    ],
  },
  { name: "Em Andamento", cards: [{ code: "PF-6", title: "Estado vazio do quadro", tag: "Alta" }] },
  {
    name: "Concluído",
    cards: [
      { code: "PF-1", title: "Filtro de tarefas por sprint", tag: "Alta" },
      { code: "PF-3", title: "Login com GitHub", tag: "Média" },
    ],
  },
];

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between gap-3 px-6">
          <Logo />
          <nav aria-label="Conta" className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/auth/login">Entrar</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/signup">Criar conta</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-[1120px] items-center gap-12 px-6 py-16 md:py-24 lg:grid-cols-[1.05fr_1fr]">
          <div className="flex flex-col gap-6">
            <Badge variant="outline" className="self-start">
              Gratuito para times pequenos
            </Badge>
            <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance md:text-5xl">
              Projetos, sprints e documentos do time no mesmo fluxo.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              O Project Flow junta quadro kanban, backlog com sprints, relatórios e documentação num só lugar,
              para o time saber o que fazer agora e o que vem depois.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/auth/signup">Criar conta grátis</Link>
              </Button>
              <DemoButton>Ver demonstração</DemoButton>
            </div>
            <p className="text-sm text-muted-foreground">
              A demonstração abre um workspace de exemplo, só para leitura, sem cadastro.
            </p>
          </div>

          <div aria-hidden="true" className="rounded-2xl border bg-sidebar p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              Project Flow
              <span className="rounded border px-1.5 text-[11px] font-medium text-muted-foreground">PF</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {PREVIEW.map((col) => (
                <div key={col.name} className="flex flex-col gap-2 rounded-xl bg-muted p-2">
                  <span className="px-1 text-xs font-semibold">
                    {col.name} <span className="text-muted-foreground">{col.cards.length}</span>
                  </span>
                  {col.cards.map((c) => (
                    <div
                      key={c.code}
                      className="flex flex-col gap-1.5 rounded-lg border bg-card p-2 shadow-xs"
                    >
                      <span className="font-mono text-[10px] text-text-secondary">{c.code}</span>
                      <span className="text-xs leading-snug font-medium">{c.title}</span>
                      <span className="self-start rounded-sm bg-info-bg px-1 text-[10px] text-info-fg">
                        {c.tag}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="recursos" className="border-t bg-sidebar">
          <div className="mx-auto max-w-[1120px] px-6 py-16">
            <h2 id="recursos" className="mb-2 text-2xl font-semibold tracking-tight">
              Tudo que um time precisa para entregar
            </h2>
            <p className="mb-8 text-muted-foreground">
              Sem integrações para montar e sem curva de aprendizado.
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex flex-col gap-2 rounded-xl border bg-card p-5">
                  <f.icon className="size-5 text-info-fg" aria-hidden="true" />
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="como-funciona" className="mx-auto max-w-[1120px] px-6 py-16">
          <h2 id="como-funciona" className="mb-8 text-2xl font-semibold tracking-tight">
            Como funciona
          </h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <div>
                  <h3 className="mb-1 font-semibold">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl border bg-sidebar p-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="mb-1 text-xl font-semibold tracking-tight">Comece em menos de um minuto</h2>
              <p className="text-muted-foreground">Crie a conta com e-mail, Google ou GitHub.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/auth/signup">
                  <UsersRound aria-hidden="true" />
                  Criar conta grátis
                </Link>
              </Button>
              <DemoButton>Ver demonstração</DemoButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-muted-foreground">
          <span>© 2026 Project Flow</span>
          <nav aria-label="Rodapé" className="flex gap-4">
            <Link href="/terms" className="hover:text-foreground">
              Termos de uso
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacidade
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
