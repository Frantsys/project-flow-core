import { expect } from "vitest";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { User, Workspace, type WorkspaceRole } from "@/server/db/models";
import type { ActionResult } from "@/types";

export { actAs } from "./session-state";

let counter = 0;

export async function createUser(name = "Pessoa") {
  await dbConnect();
  counter += 1;
  const user = await User.create({ username: `${name} ${counter}`, email: `pessoa${counter}@teste.dev` });
  return { id: user._id.toString(), email: user.email, name: user.username };
}

/** Workspace com o dono e, opcionalmente, outros membros com papéis definidos. */
export async function createWorkspace(
  ownerId: string,
  others: { userId: string; role: WorkspaceRole }[] = []
) {
  await dbConnect();
  counter += 1;
  const ws = await Workspace.create({
    name: `Workspace ${counter}`,
    slug: `workspace-${counter}`,
    ownerId,
    members: [
      { userId: ownerId, role: "OWNER", joinedAt: new Date() },
      ...others.map((m) => ({ userId: new Types.ObjectId(m.userId), role: m.role, joinedAt: new Date() })),
    ],
  });
  return { id: ws._id.toString(), slug: ws.slug };
}

/** Falha o teste se a action não deu certo, e devolve os dados. */
export function expectOk<T>(result: ActionResult<T>): T {
  if (!result.success) throw new Error(`Esperava sucesso, veio erro: ${result.error}`);
  return result.data;
}

/** Garante que a action falhou com uma mensagem que contém o trecho informado. */
export function expectFail<T>(result: ActionResult<T>, message: string) {
  expect(result.success).toBe(false);
  if (!result.success) expect(result.error).toContain(message);
}
