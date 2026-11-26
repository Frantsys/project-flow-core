import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Painéis por cima da tela. Um de cada vez: abrir um fecha o outro. */
export type Panel = "commandMenu" | "shortcuts" | "myWork";

interface UiState {
  panel: Panel | null;
  openPanel: (panel: Panel) => void;
  togglePanel: (panel: Panel) => void;
  /** Para os onOpenChange dos componentes (Esc, clique fora). */
  setPanelOpen: (panel: Panel, open: boolean) => void;

  /** Colunas recolhidas no quadro, por projeto (fica no navegador da pessoa). */
  collapsedColumns: Record<string, string[]>;
  toggleColumn: (projectId: string, statusId: string) => void;
}

/**
 * Estado só do cliente (nada aqui vai ao servidor): que painel está aberto e quais colunas
 * estão recolhidas. Dados do servidor continuam nos Server Components e nas actions.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      panel: null,
      openPanel: (panel) => set({ panel }),
      togglePanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel })),
      setPanelOpen: (panel, open) =>
        set((s) => ({ panel: open ? panel : s.panel === panel ? null : s.panel })),

      collapsedColumns: {},
      toggleColumn: (projectId, statusId) =>
        set((s) => {
          const current = s.collapsedColumns[projectId] ?? [];
          const next = current.includes(statusId)
            ? current.filter((id) => id !== statusId)
            : [...current, statusId];
          return { collapsedColumns: { ...s.collapsedColumns, [projectId]: next } };
        }),
    }),
    {
      name: "pf-ui",
      storage: createJSONStorage(() => localStorage),
      // só as colunas recolhidas sobrevivem a recarregar; painel aberto não
      partialize: (s) => ({ collapsedColumns: s.collapsedColumns }),
      // o servidor não tem localStorage: lê depois de montar (StoreHydration), para a
      // primeira renderização no navegador bater com o HTML do servidor
      skipHydration: true,
    }
  )
);
