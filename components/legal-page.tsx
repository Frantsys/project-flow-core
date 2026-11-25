import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

/** Moldura das páginas de texto (termos, privacidade): cabeçalho simples e leitura confortável. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-sidebar">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-[760px] items-center justify-between px-6">
          <Link href="/" aria-label="Página inicial">
            <Logo />
          </Link>
          <Button asChild variant="ghost">
            <Link href="/">
              <ArrowLeft aria-hidden="true" />
              Início
            </Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-[760px] px-6 py-12">
        <article className="rounded-2xl border bg-background p-8 md:p-10 [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:my-1 [&_p]:my-3 [&_p]:leading-7 [&_ul]:list-disc [&_ul]:pl-6">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">Atualizado em {updated}.</p>
          {children}
        </article>
      </main>
    </div>
  );
}
