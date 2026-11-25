import "server-only";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { ApiToken } from "../db/models";
import { hashToken } from "./auth-tokens";
import { rateLimit } from "./rate-limit";

/** Token novo: "pf_" + 32 bytes aleatórios. O valor em claro só existe na resposta da criação. */
export function newApiToken() {
  const token = `pf_${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashToken(token), prefix: token.slice(0, 10) };
}

export const apiError = (status: number, message: string) =>
  NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Autentica uma chamada da API pública pelo cabeçalho `Authorization: Bearer pf_...`.
 * Devolve o workspace do token, ou uma resposta de erro pronta (401 ou 429).
 */
export async function authenticateApi(
  request: Request
): Promise<{ workspaceId: Types.ObjectId } | { error: NextResponse }> {
  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer (pf_[\w-]{20,})$/.exec(header)?.[1];
  if (!token) return { error: apiError(401, "Envie o token no cabeçalho Authorization: Bearer pf_...") };

  await dbConnect();
  const tokenHash = hashToken(token);
  const found = await ApiToken.findOneAndUpdate(
    { tokenHash },
    { $set: { lastUsedAt: new Date() } },
    { returnDocument: "after" }
  )
    .select("workspaceId")
    .lean();
  if (!found) return { error: apiError(401, "Token inválido ou revogado.") };

  const limit = await rateLimit(`api:${found._id.toString()}`, 120, 60_000);
  if (!limit.allowed) {
    const res = apiError(429, "Limite de 120 chamadas por minuto atingido.");
    res.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return { error: res };
  }
  return { workspaceId: found.workspaceId };
}
