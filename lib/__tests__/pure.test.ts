import { describe, expect, it } from "vitest";
import { isVerifiedOAuthEmail } from "@/lib/oauth-email";
import { suggestKey } from "@/lib/project-key";
import { initials, shortDate } from "@/lib/labels";
import { describeHistory, timeAgo } from "@/lib/history-format";
import type { HistoryEntryDTO } from "@/server/db/types";

describe("isVerifiedOAuthEmail", () => {
  it("aceita Google só com email_verified === true", () => {
    expect(isVerifiedOAuthEmail({ provider: "google", email: "a@b.com", googleEmailVerified: true })).toBe(
      true
    );
    expect(isVerifiedOAuthEmail({ provider: "google", email: "a@b.com", googleEmailVerified: false })).toBe(
      false
    );
    expect(isVerifiedOAuthEmail({ provider: "google", email: "a@b.com", googleEmailVerified: "true" })).toBe(
      false
    );
  });

  it("aceita GitHub só se o mesmo e-mail estiver verificado na lista", () => {
    const emails = [
      { email: "Pessoa@Exemplo.com", primary: true, verified: false },
      { email: "outra@exemplo.com", primary: false, verified: true },
    ];
    expect(
      isVerifiedOAuthEmail({ provider: "github", email: "pessoa@exemplo.com", githubEmails: emails })
    ).toBe(false);
    expect(
      isVerifiedOAuthEmail({ provider: "github", email: "OUTRA@exemplo.com", githubEmails: emails })
    ).toBe(true);
  });

  it("recusa e-mail vazio e provedores sem regra", () => {
    expect(isVerifiedOAuthEmail({ provider: "google", email: "", googleEmailVerified: true })).toBe(false);
    expect(isVerifiedOAuthEmail({ provider: "discord", email: "a@b.com" })).toBe(false);
  });
});

describe("suggestKey", () => {
  it.each([
    ["Site institucional", "SI"],
    ["Gestão de Ônibus Urbanos", "GDOU"],
    ["Marketing", "MAR"],
    ["123 projeto", ""], // não pode começar com número
    ["", ""],
  ])("%s → %s", (name, key) => expect(suggestKey(name)).toBe(key));
});

describe("initials", () => {
  it.each([
    ["Marina Souza", "MS"],
    ["Francis", "F"],
    ["  ana   maria  costa ", "AC"],
    ["", "?"],
  ])("%s → %s", (name, value) => expect(initials(name)).toBe(value));
});

describe("shortDate", () => {
  const now = new Date("2026-11-25T15:00:00Z");
  it("mostra hoje para o mesmo dia e dia + mês nos outros", () => {
    expect(shortDate("2026-11-25T00:00:00Z", now)).toBe("hoje");
    expect(shortDate("2026-12-03T00:00:00Z", now)).toBe("3 dez");
  });
});

describe("describeHistory", () => {
  const entry = (over: Partial<HistoryEntryDTO>): HistoryEntryDTO => ({
    id: "1",
    action: "MODIFY",
    targetType: "TASK",
    actorRole: "MEMBER",
    user: null,
    details: {},
    createdAt: "2026-11-25T00:00:00Z",
    ...over,
  });

  it("traduz os valores do banco para os rótulos da interface", () => {
    expect(
      describeHistory(entry({ details: { field: "priority", oldValue: "MEDIUM", newValue: "URGENT" } }))
    ).toBe("alterou a prioridade de Média para Urgente em");
  });

  it("descreve sprints, documentos e projetos", () => {
    expect(
      describeHistory(entry({ targetType: "SPRINT", details: { field: "status", newValue: "ACTIVE" } }))
    ).toBe("iniciou a sprint");
    expect(describeHistory(entry({ targetType: "DOCUMENT", action: "CREATE" }))).toBe("criou o documento");
    expect(describeHistory(entry({ targetType: "PROJECT", action: "DELETE" }))).toBe("excluiu o projeto");
  });

  it("mostra vazio quando o campo foi limpo", () => {
    expect(describeHistory(entry({ details: { field: "assignee", oldValue: "Ana", newValue: null } }))).toBe(
      "alterou o responsável de Ana para vazio em"
    );
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-11-25T15:00:00Z");
  it("usa a unidade certa", () => {
    expect(timeAgo("2026-11-25T14:59:40Z", now)).toBe("agora");
    expect(timeAgo("2026-11-25T14:48:00Z", now)).toBe("há 12 minutos");
    expect(timeAgo("2026-11-24T15:00:00Z", now)).toBe("ontem");
  });
});
