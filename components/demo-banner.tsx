"use client";

import { signIn, signOut } from "next-auth/react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Faixa da demonstração: avisa que é só leitura e leva para o cadastro (saindo da conta demo). */
export function DemoBanner() {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b bg-info-bg px-4 py-2 text-center text-sm text-info-fg"
    >
      <Eye className="size-4" aria-hidden="true" />
      <span>Você está numa demonstração só para leitura.</span>
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        onClick={() => signOut({ callbackUrl: "/auth/signup" })}
      >
        Criar minha conta grátis
      </Button>
    </div>
  );
}

/** Entra na conta de demonstração pública, sem cadastro. */
export function DemoButton({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Button
      variant="outline"
      size="lg"
      className={className}
      onClick={() => signIn("demo", { callbackUrl: "/w/acme-labs-demo" })}
    >
      {children}
    </Button>
  );
}
