/** Sugere a chave a partir das iniciais do nome: "Site institucional" → "SI"; "Marketing" → "MAR". */
export function suggestKey(name: string) {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos: "Gestão" → "Gestao"
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const key = words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "").slice(0, 3);
  // a chave precisa começar com letra (regra de createProjectSchema)
  return /^[A-Z]/.test(key) ? key.slice(0, 10) : "";
}
