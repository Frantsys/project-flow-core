/**
 * Menções em comentários: "@Nome Completo" de um membro do workspace. Sem sintaxe especial, o
 * texto fica legível em qualquer lugar (e-mail, histórico). O mesmo código acha as menções no
 * servidor (para notificar) e destaca o nome na tela.
 */

export interface MentionMember {
  id: string;
  name: string;
}

export interface MentionPart {
  text: string;
  /** Presente quando o trecho é "@Nome" de um membro. */
  memberId?: string;
}

const isWordChar = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);

export function parseMentions(content: string, members: MentionMember[]) {
  const lower = content.toLocaleLowerCase("pt-BR");
  // nomes mais longos primeiro: "@Ana Paula" ganha de "@Ana" quando as duas existem
  const candidates = [...members]
    .filter((m) => m.name.trim())
    .map((m) => ({ ...m, key: m.name.toLocaleLowerCase("pt-BR") }))
    .sort((a, b) => b.key.length - a.key.length);

  const parts: MentionPart[] = [];
  const ids = new Set<string>();
  let last = 0;
  for (let i = lower.indexOf("@"); i !== -1; i = lower.indexOf("@", i + 1)) {
    if (isWordChar(lower[i - 1])) continue; // e-mail: nome@empresa.com
    const match = candidates.find(
      (m) => lower.startsWith(m.key, i + 1) && !isWordChar(lower[i + 1 + m.key.length])
    );
    if (!match) continue;
    const end = i + 1 + match.key.length;
    if (i > last) parts.push({ text: content.slice(last, i) });
    parts.push({ text: content.slice(i, end), memberId: match.id });
    ids.add(match.id);
    last = end;
    i = end - 1;
  }
  if (last < content.length) parts.push({ text: content.slice(last) });
  return { parts, ids: [...ids] };
}
