import "server-only";
import mongoose, { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { User, Workspace } from "../db/models";

export interface AccountDTO {
  name: string;
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  /** Provedores OAuth ligados à conta: "google", "github". */
  providers: string[];
  /** Workspaces de que a pessoa é dona: impedem a exclusão da conta. */
  ownedWorkspaces: { name: string; slug: string }[];
}

/** Coleção criada pelo adapter do NextAuth, no mesmo banco dos models. */
export const accountsCollection = () => mongoose.connection.collection("accounts");

export async function getAccount(userId: string): Promise<AccountDTO | null> {
  if (!Types.ObjectId.isValid(userId)) return null;
  await dbConnect();

  const [user, links, owned] = await Promise.all([
    User.findById(userId).select("username email emailVerified +passwordHash").lean(),
    accountsCollection()
      .find({ userId: new Types.ObjectId(userId) }, { projection: { provider: 1 } })
      .toArray(),
    Workspace.find({ ownerId: userId }).select("name slug").sort({ name: 1 }).lean(),
  ]);
  if (!user) return null;

  return {
    name: user.username,
    email: user.email,
    emailVerified: !!user.emailVerified,
    hasPassword: !!user.passwordHash,
    providers: [...new Set(links.map((l) => String(l.provider)))].sort(),
    ownedWorkspaces: owned.map((w) => ({ name: w.name, slug: w.slug })),
  };
}
