import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import {
  requestPasswordResetAction,
  resetPasswordAction,
  signUpAction,
  verifyEmailAction,
} from "@/server/actions/auth.actions";
import { changePasswordAction, deleteAccountAction } from "@/server/actions/account.actions";
import { AuthToken, User, Workspace } from "@/server/db/models";
import { issueToken } from "@/server/lib/auth-tokens";
import { rateLimit } from "@/server/lib/rate-limit";
import { actAs, createUser, createWorkspace, expectFail, expectOk } from "../../test/helpers";

const password = "senha-forte-1";

async function userWithPassword() {
  const user = await createUser("Senha");
  await User.updateOne({ _id: user.id }, { $set: { passwordHash: await bcrypt.hash(password, 4) } });
  return user;
}

describe("limite de tentativas", () => {
  it("bloqueia a partir da tentativa seguinte ao limite", async () => {
    const results = [];
    for (let i = 0; i < 6; i++) results.push((await rateLimit("teste:ip", 5, 60_000)).allowed);
    expect(results).toEqual([true, true, true, true, true, false]);
    expect((await rateLimit("outra:chave", 5, 60_000)).allowed).toBe(true);
  });

  it("conta certo com tentativas simultâneas", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => rateLimit("paralelo", 5, 60_000)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it("freia o cadastro em massa do mesmo IP", async () => {
    for (let i = 0; i < 5; i++) {
      expectOk(
        await signUpAction({
          username: `Pessoa ${i}`,
          email: `massa${i}@teste.dev`,
          password,
          confirmPassword: password,
        })
      );
    }
    expectFail(
      await signUpAction({
        username: "Sexta",
        email: "massa6@teste.dev",
        password,
        confirmPassword: password,
      }),
      "Muitas tentativas"
    );
  });
});

describe("recuperação de senha", () => {
  it("responde igual para e-mail cadastrado e desconhecido", async () => {
    const user = await userWithPassword();
    expect(expectOk(await requestPasswordResetAction({ email: user.email }))).toEqual({ sent: true });
    expect(expectOk(await requestPasswordResetAction({ email: "ninguem@teste.dev" }))).toEqual({
      sent: true,
    });
    expect(await AuthToken.countDocuments({ purpose: "RESET_PASSWORD" })).toBe(1);
  });

  it("troca a senha uma única vez com o mesmo link e confirma o e-mail", async () => {
    const user = await userWithPassword();
    const token = await issueToken(user.id, "RESET_PASSWORD");
    const input = { token, password: "nova-senha-123", confirmPassword: "nova-senha-123" };

    expectOk(await resetPasswordAction(input));
    expectFail(await resetPasswordAction(input), "expirou ou já foi usado");

    const saved = await User.findById(user.id).select("+passwordHash emailVerified").lean();
    expect(await bcrypt.compare("nova-senha-123", saved!.passwordHash!)).toBe(true);
    expect(saved!.emailVerified).toBeInstanceOf(Date);
  });

  it("recusa link vencido e link antigo depois de pedir outro", async () => {
    const user = await userWithPassword();
    const old = await issueToken(user.id, "RESET_PASSWORD");
    const fresh = await issueToken(user.id, "RESET_PASSWORD");
    const body = { password: "nova-senha-123", confirmPassword: "nova-senha-123" };
    expectFail(await resetPasswordAction({ token: old, ...body }), "expirou");

    await AuthToken.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expectFail(await resetPasswordAction({ token: fresh, ...body }), "expirou");
  });

  it("não aceita token de verificação para trocar senha", async () => {
    const user = await userWithPassword();
    const token = await issueToken(user.id, "VERIFY_EMAIL");
    expectFail(
      await resetPasswordAction({ token, password: "nova-senha-123", confirmPassword: "nova-senha-123" }),
      "expirou"
    );
    expectOk(await verifyEmailAction({ token }));
    expect((await User.findById(user.id).lean())?.emailVerified).toBeInstanceOf(Date);
  });
});

describe("minha conta", () => {
  it("troca a senha só com a senha atual correta", async () => {
    const user = await userWithPassword();
    actAs(user.id);
    const next = { password: "outra-senha-9", confirmPassword: "outra-senha-9" };
    expectFail(await changePasswordAction({ currentPassword: "errada", ...next }), "Senha atual incorreta");
    expectOk(await changePasswordAction({ currentPassword: password, ...next }));
  });

  it("conta só com Google/GitHub é orientada a criar senha pelo link", async () => {
    const user = await createUser("OAuth");
    actAs(user.id);
    expectFail(
      await changePasswordAction({
        currentPassword: "x",
        password: "nova-senha-1",
        confirmPassword: "nova-senha-1",
      }),
      "Esqueci a senha"
    );
  });

  it("dono de workspace não exclui a conta; membro sai de todos os workspaces", async () => {
    const owner = await createUser("Dono");
    const member = await createUser("Membro");
    const ws = await createWorkspace(owner.id, [{ userId: member.id, role: "MEMBER" }]);

    actAs(owner.id);
    expectFail(await deleteAccountAction({ email: owner.email }), "workspaces de que você é dono");

    actAs(member.id);
    expectFail(await deleteAccountAction({ email: "outro@teste.dev" }), "não confere");
    expectOk(await deleteAccountAction({ email: member.email }));

    expect(await User.exists({ _id: member.id })).toBeNull();
    const members = (await Workspace.findById(ws.id).lean())!.members.map((m) => m.userId.toString());
    expect(members).toEqual([owner.id]);
  });
});
