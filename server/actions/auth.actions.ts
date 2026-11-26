"use server";

import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import { User } from "../db/models";
import { createAction, fail } from "../lib/action";
import { consumeToken, sendPasswordResetEmail, sendVerificationEmail } from "../lib/auth-tokens";
import { clientIp, enforceRateLimit } from "../lib/rate-limit";
import { forgotPasswordSchema, resetPasswordSchema, signUpSchema, verifyEmailSchema } from "../schemas";
import { z } from "zod";

const HOUR = 3_600_000;

const isDuplicateKey = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;

/** E-mail é efeito colateral: se a Resend falhar, a ação principal continua valendo. */
async function trySend(send: () => Promise<void>, name: string) {
  try {
    await send();
  } catch (error) {
    console.error(`[email:${name}]`, error);
  }
}

export const signUpAction = createAction({
  name: "auth.signUp",
  schema: signUpSchema,
  public: true,
  handler: async ({ username, email, password }) => {
    await enforceRateLimit(`signup:${await clientIp()}`, 5, HOUR);
    await dbConnect();

    const existingUser = await User.findOne({ email })
      .select("+passwordHash")
      .lean<{ passwordHash?: string | null }>();

    if (existingUser) {
      // a pessoa já entrou antes com Google ou GitHub usando esse e-mail
      if (!existingUser.passwordHash) fail("Este e-mail já está vinculado a uma conta Google ou GitHub.");
      fail("Este e-mail já está cadastrado.", { email: ["Este e-mail já está cadastrado."] });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    try {
      const newUser = await User.create({ username, email, passwordHash });
      const user = { id: newUser._id.toString(), email: newUser.email };
      await trySend(() => sendVerificationEmail(user), "verify");
      return user;
    } catch (error) {
      // dois cadastros simultâneos com o mesmo e-mail: o índice único segura o segundo
      if (isDuplicateKey(error))
        fail("Este e-mail já está cadastrado.", { email: ["Este e-mail já está cadastrado."] });
      throw error;
    }
  },
});

/**
 * Envia o link de redefinição. A resposta é sempre a mesma, exista a conta ou não, para não
 * revelar quais e-mails estão cadastrados. Contas só com Google/GitHub podem criar uma senha assim.
 */
export const requestPasswordResetAction = createAction({
  name: "auth.requestPasswordReset",
  schema: forgotPasswordSchema,
  public: true,
  handler: async ({ email }) => {
    await enforceRateLimit(`forgot:ip:${await clientIp()}`, 5, HOUR);
    await enforceRateLimit(`forgot:email:${email}`, 3, HOUR);
    await dbConnect();

    const user = await User.findOne({ email }).select("_id email").lean();
    if (user) {
      await trySend(() => sendPasswordResetEmail({ id: user._id.toString(), email: user.email }), "reset");
    }
    return { sent: true };
  },
});

export const resetPasswordAction = createAction({
  name: "auth.resetPassword",
  schema: resetPasswordSchema,
  public: true,
  handler: async ({ token, password }) => {
    await enforceRateLimit(`reset:${await clientIp()}`, 10, HOUR);
    const userId = await consumeToken(token, "RESET_PASSWORD");
    if (!userId) fail("Este link expirou ou já foi usado. Peça um novo.");

    const passwordHash = await bcrypt.hash(password, 12);
    // o link chegou no e-mail da pessoa: isso também confirma o e-mail
    // e encerra as sessões abertas: quem pede uma senha nova pode estar com a conta invadida
    await User.updateOne(
      { _id: userId },
      { $set: { passwordHash, emailVerified: new Date() }, $inc: { sessionVersion: 1 } }
    );
    return { reset: true };
  },
});

export const verifyEmailAction = createAction({
  name: "auth.verifyEmail",
  schema: verifyEmailSchema,
  public: true,
  handler: async ({ token }) => {
    await enforceRateLimit(`verify:${await clientIp()}`, 10, HOUR);
    const userId = await consumeToken(token, "VERIFY_EMAIL");
    if (!userId) fail("Este link expirou ou já foi usado. Peça um novo em Minha conta.");

    await User.updateOne({ _id: userId }, { $set: { emailVerified: new Date() } });
    return { verified: true };
  },
});

export const resendVerificationAction = createAction({
  name: "auth.resendVerification",
  schema: z.object({}),
  handler: async (_input, { userId }) => {
    await enforceRateLimit(`resend-verify:${userId}`, 3, HOUR);
    await dbConnect();

    const user = await User.findById(userId).select("email emailVerified").lean();
    if (!user) fail("Conta não encontrada.");
    if (user.emailVerified) fail("Seu e-mail já está confirmado.");

    await sendVerificationEmail({ id: userId, email: user.email });
    return { sent: true };
  },
});
