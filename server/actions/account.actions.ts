"use server";

import bcrypt from "bcryptjs";
import mongoose, { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import dbConnect from "@/lib/db";
import { AuthToken, Task, User, Workspace } from "../db/models";
import { createAction, fail } from "../lib/action";
import { enforceRateLimit } from "../lib/rate-limit";
import { accountsCollection } from "../services/account.service";
import { changePasswordSchema, deleteAccountSchema, updateProfileSchema } from "../schemas";
import { z } from "zod";
import QRCode from "qrcode";
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateSecret,
  hashRecoveryCode,
  otpauthUrl,
  verifyTotp,
} from "../lib/totp";
import { checkSecondFactor } from "../lib/two-factor";

export const updateProfileAction = createAction({
  name: "account.updateProfile",
  schema: updateProfileSchema,
  handler: async ({ username }, { userId }) => {
    await dbConnect();
    await User.updateOne({ _id: userId }, { $set: { username } });
    revalidatePath("/", "layout");
    return { username };
  },
});

export const updateNotificationPrefsAction = createAction({
  name: "account.notificationPrefs",
  schema: z.object({ notifyByEmail: z.boolean() }),
  handler: async ({ notifyByEmail }, { userId }) => {
    await dbConnect();
    await User.updateOne({ _id: userId }, { $set: { notifyByEmail } });
    return { notifyByEmail };
  },
});

export const changePasswordAction = createAction({
  name: "account.changePassword",
  schema: changePasswordSchema,
  handler: async ({ currentPassword, password }, { userId }) => {
    // a senha atual é conferida aqui: sem limite, a action viraria um atalho para força bruta
    await enforceRateLimit(`change-password:${userId}`, 5, 15 * 60_000);
    await dbConnect();

    const user = await User.findById(userId).select("+passwordHash");
    if (!user) fail("Conta não encontrada.");
    if (!user.passwordHash) {
      fail("Sua conta entra pelo Google ou GitHub. Para criar uma senha, use “Esqueci a senha” no login.");
    }
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      fail("Senha atual incorreta.", { currentPassword: ["Senha atual incorreta."] });
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    await user.save();
    return { changed: true };
  },
});

/**
 * Exclui a conta e os vínculos dela. Quem é dono de algum workspace precisa excluí-lo antes,
 * para nenhum time ficar sem dono. Comentários e histórico continuam, sem o autor.
 */
export const deleteAccountAction = createAction({
  name: "account.delete",
  schema: deleteAccountSchema,
  handler: async ({ email }, { userId }) => {
    await dbConnect();
    const user = await User.findById(userId).select("email").lean();
    if (!user) fail("Conta não encontrada.");
    if (user.email !== email) fail("O e-mail não confere.", { email: ["Digite o e-mail da sua conta."] });

    const owned = await Workspace.countDocuments({ ownerId: userId });
    if (owned > 0) fail("Exclua os workspaces de que você é dono antes de excluir a conta.");

    const id = new Types.ObjectId(userId);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Workspace.updateMany(
          { "members.userId": id },
          { $pull: { members: { userId: id } } },
          { session }
        );
        await Task.updateMany({ assigneeId: id }, { $set: { assigneeId: null } }, { session });
        await AuthToken.deleteMany({ userId: id }, { session });
        await accountsCollection().deleteMany({ userId: id }, { session });
        await User.deleteOne({ _id: id }, { session });
      });
    } finally {
      await session.endSession();
    }
    return { deleted: true };
  },
});

const twoFactorCodeSchema = z.object({
  code: z.string().trim().min(6, "Digite o código de 6 dígitos.").max(20, "Código inválido."),
});

/** Passo 1: gera o segredo (ainda pendente) e o QR code para o aplicativo autenticador. */
export const startTwoFactorAction = createAction({
  name: "account.twoFactor.start",
  schema: z.object({}),
  handler: async (_input, { userId }) => {
    await enforceRateLimit(`2fa-setup:${userId}`, 10, 3_600_000);
    await dbConnect();
    const user = await User.findById(userId).select("email twoFactorEnabled").lean();
    if (!user) fail("Conta não encontrada.");
    if (user.twoFactorEnabled) fail("A verificação em duas etapas já está ligada.");

    const secret = generateSecret();
    await User.updateOne({ _id: userId }, { $set: { twoFactorPendingSecret: encryptSecret(secret) } });
    const qr = await QRCode.toDataURL(otpauthUrl(secret, user.email), { margin: 1, width: 220 });
    return { qr, secret };
  },
});

/** Passo 2: confere o primeiro código, liga a proteção e devolve os códigos de recuperação (uma vez). */
export const confirmTwoFactorAction = createAction({
  name: "account.twoFactor.confirm",
  schema: twoFactorCodeSchema,
  handler: async ({ code }, { userId }) => {
    await enforceRateLimit(`2fa-confirm:${userId}`, 10, 15 * 60_000);
    await dbConnect();
    const user = await User.findById(userId).select("+twoFactorPendingSecret twoFactorEnabled").lean();
    if (!user?.twoFactorPendingSecret) fail("Comece a configuração de novo.");
    const step = verifyTotp(decryptSecret(user.twoFactorPendingSecret), code);
    if (step === null)
      fail("Código incorreto. Confira o horário do celular e tente de novo.", {
        code: ["Código incorreto."],
      });

    const recoveryCodes = generateRecoveryCodes();
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          twoFactorEnabled: true,
          twoFactorSecret: user.twoFactorPendingSecret,
          twoFactorPendingSecret: null,
          twoFactorLastStep: step,
          recoveryCodes: recoveryCodes.map(hashRecoveryCode),
        },
      }
    );
    return { recoveryCodes };
  },
});

/** Desliga a proteção; exige um código válido (do aplicativo ou de recuperação). */
export const disableTwoFactorAction = createAction({
  name: "account.twoFactor.disable",
  schema: twoFactorCodeSchema,
  handler: async ({ code }, { userId }) => {
    await enforceRateLimit(`2fa-disable:${userId}`, 10, 15 * 60_000);
    await dbConnect();
    if (!(await checkSecondFactor(userId, code))) fail("Código incorreto.", { code: ["Código incorreto."] });
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorPendingSecret: null,
          twoFactorLastStep: 0,
          recoveryCodes: [],
        },
      }
    );
    return { disabled: true };
  },
});
