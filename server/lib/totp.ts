import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * TOTP (RFC 6238) para a verificação em duas etapas, compatível com Google Authenticator, Authy,
 * 1Password etc.: HMAC-SHA1, 6 dígitos, passos de 30 segundos. Sem dependência, testado com os
 * vetores da própria RFC (server/__tests__/two-factor.test.ts).
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP = 30;

export function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string) {
  const clean = text.replace(/[\s=]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Segredo base32 inválido.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Código de 6 dígitos para um passo de tempo (contador). */
export function hotp(secret: Buffer, counter: number, digits = 6) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(msg).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(code).padStart(digits, "0");
}

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP);

export function generateSecret() {
  return base32Encode(randomBytes(20));
}

/**
 * Confere o código aceitando um passo antes e um depois (relógio do celular adiantado ou atrasado).
 * Devolve o passo que bateu, para impedir que o mesmo código seja usado duas vezes.
 */
export function verifyTotp(secretBase32: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const step = currentStep(now);
  for (const s of [step - 1, step, step + 1]) {
    const expected = Buffer.from(hotp(secret, s));
    if (timingSafeEqual(expected, Buffer.from(code))) return s;
  }
  return null;
}

export function otpauthUrl(secretBase32: string, account: string) {
  const label = encodeURIComponent(`Project Flow:${account}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=Project%20Flow&algorithm=SHA1&digits=6&period=${STEP}`;
}

// --- segredo guardado criptografado: um vazamento do banco não entrega os códigos de ninguém ---

const key = () => {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET não configurado.");
  return createHash("sha256").update(`two-factor:${secret}`).digest();
};

/** AES-256-GCM; formato "iv.tag.dados" em base64url. Trocar NEXTAUTH_SECRET invalida os segredos. */
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(stored: string) {
  const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv!);
  decipher.setAuthTag(tag!);
  return Buffer.concat([decipher.update(data!), decipher.final()]).toString("utf8");
}

/** Códigos de recuperação: 8 de 10 caracteres, mostrados uma vez; o banco guarda só o hash. */
export function generateRecoveryCodes() {
  return Array.from({ length: 8 }, () => {
    const raw = base32Encode(randomBytes(7)).slice(0, 10).toLowerCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export const hashRecoveryCode = (code: string) =>
  createHash("sha256").update(code.trim().toLowerCase().replace(/\s/g, "")).digest("hex");
