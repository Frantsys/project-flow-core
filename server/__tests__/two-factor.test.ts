import { describe, expect, it } from "vitest";
import {
  confirmTwoFactorAction,
  disableTwoFactorAction,
  startTwoFactorAction,
} from "@/server/actions/account.actions";
import { User } from "@/server/db/models";
import {
  base32Decode,
  base32Encode,
  currentStep,
  decryptSecret,
  encryptSecret,
  hotp,
  verifyTotp,
} from "@/server/lib/totp";
import { checkSecondFactor } from "@/server/lib/two-factor";
import { actAs, createUser, expectFail, expectOk } from "../../test/helpers";

describe("TOTP (RFC 6238)", () => {
  // vetores do apêndice B da RFC, SHA-1, 8 dígitos
  const secret = Buffer.from("12345678901234567890");
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ])("tempo %i → %s", (seconds, expected) => {
    expect(hotp(secret, Math.floor(seconds / 30), 8)).toBe(expected);
  });

  it("base32 e criptografia do segredo voltam ao original", () => {
    expect(base32Decode(base32Encode(secret)).equals(secret)).toBe(true);
    expect(decryptSecret(encryptSecret("JBSWY3DPEHPK3PXP"))).toBe("JBSWY3DPEHPK3PXP");
  });

  it("aceita um passo de diferença no relógio e recusa dois", () => {
    const b32 = base32Encode(secret);
    const now = Date.now();
    const step = currentStep(now);
    expect(verifyTotp(b32, hotp(secret, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(b32, hotp(secret, step - 2), now)).toBeNull();
    expect(verifyTotp(b32, "abc123", now)).toBeNull();
  });
});

describe("verificação em duas etapas", () => {
  async function enable() {
    const user = await createUser("Segura");
    actAs(user.id);
    const { secret } = expectOk(await startTwoFactorAction({}));
    const raw = base32Decode(secret);
    expectFail(await confirmTwoFactorAction({ code: "000000" }), "Código incorreto");
    const { recoveryCodes } = expectOk(await confirmTwoFactorAction({ code: hotp(raw, currentStep()) }));
    return { user, raw, secret, recoveryCodes };
  }

  it("liga com um código válido e devolve 8 códigos de recuperação", async () => {
    const { user, secret, recoveryCodes } = await enable();
    expect(recoveryCodes).toHaveLength(8);
    const saved = await User.findById(user.id).select("+twoFactorSecret +recoveryCodes").lean();
    expect(saved?.twoFactorEnabled).toBe(true);
    // nada em texto claro no banco
    expect(saved?.twoFactorSecret).not.toContain(secret);
    expect(decryptSecret(saved!.twoFactorSecret!)).toBe(secret);
    expect(saved?.recoveryCodes).not.toContain(recoveryCodes[0]);
  });

  it("cada código vale uma vez: o do aplicativo e o de recuperação", async () => {
    const { user, raw, recoveryCodes } = await enable();
    // o código usado para ligar já não serve para entrar
    expect(await checkSecondFactor(user.id, hotp(raw, currentStep()))).toBe(false);
    const next = hotp(raw, currentStep() + 1);
    expect(await checkSecondFactor(user.id, next)).toBe(true);
    expect(await checkSecondFactor(user.id, next)).toBe(false);

    expect(await checkSecondFactor(user.id, recoveryCodes[0]!.toUpperCase())).toBe(true);
    expect(await checkSecondFactor(user.id, recoveryCodes[0]!)).toBe(false);
  });

  it("desligar exige um código válido", async () => {
    const { user, recoveryCodes } = await enable();
    expectFail(await disableTwoFactorAction({ code: "123456" }), "Código incorreto");
    expectOk(await disableTwoFactorAction({ code: recoveryCodes[1]! }));
    expect((await User.findById(user.id).lean())?.twoFactorEnabled).toBe(false);
  });
});
