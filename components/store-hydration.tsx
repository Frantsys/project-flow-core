"use client";

import { useEffect } from "react";
import { useUiStore } from "@/store/ui-store";

/** Lê do localStorage o estado guardado da interface depois que a página monta. */
export function StoreHydration() {
  useEffect(() => {
    void useUiStore.persist.rehydrate();
  }, []);
  return null;
}
