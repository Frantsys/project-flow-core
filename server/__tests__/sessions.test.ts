import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import type { JWT } from "next-auth/jwt";
import type { Account, Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { changePasswordAction, signOutEverywhereAction } from "@/server/actions/account.actions";
import { resetPasswordAction } from "@/server/actions/auth.actions";
import { User } from "@/server/db/models";
import { issueToken } from "@/server/lib/auth-tokens";
import { actAs, createUser, expectOk } from "../../test/helpers";

const { jwt, session } = authOptions.callbacks!;
const login = { provider: "credentials", type: "credentials" } as Account;

/** Simula o NextAuth: o login grava o token, cada leitura depois passa por jwt() e session(). */
const signIn = async (userId: string) =>
  (await jwt!({ token: { sub: userId }, account: login } as never)) as JWT;
const read = async (token: JWT) => {
  const next = (await jwt!({ token } as never)) as JWT;
  return (await session!({
    session: { user: { name: "x" }, expires: "2099-01-01" } as Session,
    token: next,
  } as never)) as Session;
};

async function userWithPassword() {
  const user = await createUser("Sessão");
  await User.updateOne({ _id: user.id }, { $set: { passwordHash: await bcrypt.hash("senha-antiga-1", 4) } });
  return user;
}

describe("encerrar sessões", () => {
  it("token emitido antes desta mudança (sem versão) continua valendo", async () => {
    const user = await createUser("Antigo");
    expect((await read({ sub: user.id })).user).toBeDefined();
  });

  it("trocar a senha encerra as sessões abertas", async () => {
    const user = await userWithPassword();
    const token = await signIn(user.id);
    expect((await read(token)).user).toBeDefined();

    actAs(user.id);
    expectOk(
      await changePasswordAction({
        currentPassword: "senha-antiga-1",
        password: "senha-nova-12",
        confirmPassword: "senha-nova-12",
      })
    );
    expect((await read(token)).user).toBeUndefined();
    // e um login novo volta a funcionar
    expect((await read(await signIn(user.id))).user).toBeDefined();
  });

  it("redefinir a senha pelo link e 'sair de todos' também encerram", async () => {
    const user = await userWithPassword();
    const first = await signIn(user.id);
    const link = await issueToken(user.id, "RESET_PASSWORD");
    expectOk(
      await resetPasswordAction({ token: link, password: "outra-senha-9", confirmPassword: "outra-senha-9" })
    );
    expect((await read(first)).user).toBeUndefined();

    const second = await signIn(user.id);
    actAs(user.id);
    expectOk(await signOutEverywhereAction({}));
    expect((await read(second)).user).toBeUndefined();
  });

  it("conta excluída não mantém a sessão", async () => {
    const user = await createUser("Some");
    const token = await signIn(user.id);
    await User.deleteOne({ _id: user.id });
    expect((await read(token)).user).toBeUndefined();
  });
});
