import "server-only";
import { headers } from "next/headers";
import dbConnect from "@/lib/db";
import { RateLimit } from "../db/models";
import { fail } from "./action";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

const isDuplicateKey = (error: unknown) => (error as { code?: number } | null)?.code === 11000;

/**
 * Conta uma tentativa na janela atual de `key` e diz se ainda está dentro do limite.
 * Janela fixa guardada no MongoDB: funciona entre instâncias serverless sem serviço extra.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  await dbConnect();
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const expiresAt = new Date(windowStart + windowMs);
  const hit = () =>
    RateLimit.findOneAndUpdate(
      { _id: `${key}:${windowStart}` },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: "after" }
    ).lean();

  // dois upserts simultâneos da mesma janela: o segundo bate no _id e só precisa repetir
  const doc = await hit().catch((error) => (isDuplicateKey(error) ? hit() : Promise.reject(error)));
  return {
    allowed: (doc?.count ?? 0) <= limit,
    retryAfterSeconds: Math.ceil((expiresAt.getTime() - now) / 1000),
  };
}

export function tooManyAttemptsMessage(retryAfterSeconds: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Muitas tentativas. Tente de novo em ${minutes} min.`;
}

/** Interrompe a action quando o limite estoura. */
export async function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const result = await rateLimit(key, limit, windowMs);
  if (!result.allowed) fail(tooManyAttemptsMessage(result.retryAfterSeconds));
}

/** IP do cliente informado pela Vercel (primeiro item de x-forwarded-for). */
export function ipFrom(forwardedFor: string | null | undefined) {
  return forwardedFor?.split(",")[0]?.trim() || "local";
}

export async function clientIp() {
  return ipFrom((await headers()).get("x-forwarded-for"));
}
