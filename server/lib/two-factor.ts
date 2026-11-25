import { Types } from "mongoose";
import { User } from "../db/models";
import { decryptSecret, hashRecoveryCode, verifyTotp } from "./totp";

/**
 * Confere o segundo fator do login: um código do aplicativo autenticador ou um código de
 * recuperação. Cada código vale uma vez só (o passo de tempo usado fica gravado e o código de
 * recuperação é apagado), com escrita condicional para dois logins simultâneos não reaproveitarem.
 */
export async function checkSecondFactor(userId: Types.ObjectId | string, input: string) {
  const code = input.trim();
  const user = await User.findById(userId).select("+twoFactorSecret +twoFactorLastStep").lean();
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) return false;

  if (/^\d{6}$/.test(code)) {
    const step = verifyTotp(decryptSecret(user.twoFactorSecret), code);
    if (step === null) return false;
    const result = await User.updateOne(
      { _id: userId, twoFactorLastStep: { $lt: step } },
      { $set: { twoFactorLastStep: step } }
    );
    return result.modifiedCount === 1;
  }

  const hash = hashRecoveryCode(code);
  const result = await User.updateOne(
    { _id: userId, recoveryCodes: hash },
    { $pull: { recoveryCodes: hash } }
  );
  return result.modifiedCount === 1;
}
