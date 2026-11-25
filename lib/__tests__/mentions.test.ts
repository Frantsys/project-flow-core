import { describe, expect, it } from "vitest";
import { parseMentions } from "@/lib/mentions";

const members = [
  { id: "ana", name: "Ana" },
  { id: "anapaula", name: "Ana Paula" },
  { id: "joao", name: "João Pereira" },
];

describe("menções", () => {
  it("acha o nome completo, sem diferenciar maiúsculas, e prefere o nome mais longo", () => {
    const { ids, parts } = parseMentions("Oi @ana paula e @JOÃO PEREIRA, vejam isso. @Ana também.", members);
    expect(ids).toEqual(["anapaula", "joao", "ana"]);
    expect(parts.filter((p) => p.memberId).map((p) => p.text)).toEqual([
      "@ana paula",
      "@JOÃO PEREIRA",
      "@Ana",
    ]);
    expect(parts.map((p) => p.text).join("")).toBe("Oi @ana paula e @JOÃO PEREIRA, vejam isso. @Ana também.");
  });

  it("ignora e-mails, nomes que continuam e quem não é membro", () => {
    expect(parseMentions("escreva para ana@empresa.com", members).ids).toEqual([]);
    expect(parseMentions("@Anabela chegou", members).ids).toEqual([]);
    expect(parseMentions("@Carlos", members).ids).toEqual([]);
  });
});
