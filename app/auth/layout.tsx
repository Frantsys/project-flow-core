import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/auth">) {
  return (
    <div className="flex min-h-svh flex-wrap">
      <section className="flex flex-[1_1_420px] flex-col justify-between gap-10 bg-primary p-10 text-primary-foreground">
        <Logo inverted />
        <div className="max-w-md">
          <h2 className="mb-3 text-[32px] leading-tight font-semibold tracking-tight text-balance">
            Workspaces, projetos, sprints e documentos no mesmo fluxo.
          </h2>
          <p className="text-[15px] leading-relaxed text-primary-foreground/70">
            Organize o trabalho do time em quadros kanban, planeje sprints e acompanhe cada alteração.
          </p>
        </div>
      </section>
      <main className="flex min-w-0 flex-[999_1_480px] items-center justify-center px-6 py-10">
        <div className="w-full max-w-[380px]">{children}</div>
      </main>
    </div>
  );
}
