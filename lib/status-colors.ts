import type { StatusCategory } from "@/server/db/types";

/** Cores das colunas do quadro (o nome é o que fica gravado; o hex só na tela). */
export const STATUS_COLORS = {
  gray: { label: "Cinza", hex: "#a3a3a3" },
  blue: { label: "Azul", hex: "#2563eb" },
  violet: { label: "Roxo", hex: "#7c3aed" },
  pink: { label: "Rosa", hex: "#db2777" },
  red: { label: "Vermelho", hex: "#dc2626" },
  orange: { label: "Laranja", hex: "#ea580c" },
  yellow: { label: "Amarelo", hex: "#ca8a04" },
  green: { label: "Verde", hex: "#16a34a" },
  teal: { label: "Verde-azulado", hex: "#0d9488" },
} as const;

export type StatusColor = keyof typeof STATUS_COLORS;
export const STATUS_COLOR_KEYS = Object.keys(STATUS_COLORS) as [StatusColor, ...StatusColor[]];

const BY_CATEGORY: Record<StatusCategory, StatusColor> = { TODO: "gray", IN_PROGRESS: "blue", DONE: "green" };

/** Cor da coluna: a escolhida ou, sem escolha, a do tipo (a fazer cinza, andamento azul, feito verde). */
export const statusHex = (s: { color?: StatusColor | null; category: StatusCategory }) =>
  STATUS_COLORS[s.color ?? BY_CATEGORY[s.category]].hex;
