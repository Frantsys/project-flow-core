import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { appUrl, sendEmail } from "@/lib/email";
import { AuthToken, type AuthTokenPurpose } from "../db/models";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const TOKEN_TTL: Record<AuthTokenPurpose, number> = {
  RESET_PASSWORD: 30 * 60_000,
  VERIFY_EMAIL: 24 * 3_600_000,
};

/** Cria um token novo (invalidando os anteriores do mesmo tipo) e devolve o valor em claro. */
export async function issueToken(userId: string, purpose: AuthTokenPurpose) {
  await dbConnect();
  const token = randomBytes(32).toString("base64url");
  await AuthToken.deleteMany({ userId, purpose });
  await AuthToken.create({
    userId,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL[purpose]),
  });
  return token;
}

/** Usa o token uma única vez (busca e apaga na mesma operação). Devolve o id do usuário ou null. */
export async function consumeToken(token: string, purpose: AuthTokenPurpose) {
  await dbConnect();
  const doc = await AuthToken.findOneAndDelete({
    tokenHash: hashToken(token),
    purpose,
    expiresAt: { $gt: new Date() },
  }).lean<{ userId: Types.ObjectId }>();
  return doc?.userId.toString() ?? null;
}

export async function sendVerificationEmail(user: { id: string; email: string }) {
  const token = await issueToken(user.id, "VERIFY_EMAIL");
  await sendEmail({
    to: user.email,
    subject: "Confirme seu e-mail no Project Flow",
    intro: "Confirme que este e-mail é seu para manter a conta segura e poder recuperar a senha.",
    action: { label: "Confirmar e-mail", url: `${appUrl()}/auth/verify?token=${token}` },
    footnote: "O link vale por 24 horas. Se você não criou uma conta, ignore este e-mail.",
  });
}

export async function sendPasswordResetEmail(user: { id: string; email: string }) {
  const token = await issueToken(user.id, "RESET_PASSWORD");
  await sendEmail({
    to: user.email,
    subject: "Redefinir sua senha do Project Flow",
    intro: "Recebemos um pedido para redefinir a senha da sua conta. Clique abaixo para escolher uma nova.",
    action: { label: "Redefinir senha", url: `${appUrl()}/auth/reset?token=${token}` },
    footnote: "O link vale por 30 minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail.",
  });
}
