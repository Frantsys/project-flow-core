import { ViewTransition } from "react";

/**
 * Conteúdo que chega depois do esqueleto (dentro de um Suspense): aparece subindo de leve em
 * vez de pular no lugar. Não anima em outras atualizações da página.
 */
export function Reveal({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="reveal" exit="none" update="none" default="none">
      {children}
    </ViewTransition>
  );
}
