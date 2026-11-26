/** Parâmetros da URL que uma visão salva guarda: os filtros e o agrupamento. */
export const VIEW_KEYS = ["q", "assignee", "priority", "type", "tag", "group"] as const;

/** Mesmos filtros dão a mesma string, em qualquer ordem: é assim que a visão ativa é reconhecida. */
export function viewQuery(get: (key: string) => string | null | undefined) {
  const params = new URLSearchParams();
  for (const key of VIEW_KEYS) {
    const value = get(key)?.trim();
    if (value) params.set(key, value.slice(0, 100));
  }
  return params.toString();
}

export interface SavedViewDTO {
  id: string;
  name: string;
  query: string;
}
