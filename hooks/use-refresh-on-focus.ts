"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Busca os dados de novo quando a pessoa volta para a aba (e no máximo a cada `minInterval`).
 * shortcut: substitui o tempo real (WebSocket/Pusher, roadmap 5.3) enquanto não houver um serviço
 * de eventos; quem está com a aba aberta e parada só vê mudanças de outros ao voltar a ela.
 */
export function useRefreshOnFocus(enabled = true, minInterval = 15_000) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < minInterval) return;
      last = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [enabled, minInterval, router]);
}
