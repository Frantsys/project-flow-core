/* eslint-disable @typescript-eslint/no-unused-vars */
import { JWT } from "next-auth/jwt";
import NextAuth, { DefaultSession, User } from "next-auth";

export interface CustomAuthUser extends User {
  id: string;
  /** Entrou pelo botão "Ver demonstração": só leitura. */
  demo?: boolean;
}

declare module "next-auth" {
  interface Session {
    user?: CustomAuthUser & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    user?: CustomAuthUser;
    demo?: boolean;
    /** sessionVersion do usuário quando o token foi emitido. */
    sv?: number;
    /** A versão mudou depois: a sessão foi encerrada em outro lugar. */
    revoked?: boolean;
  }
}
