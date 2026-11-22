/* eslint-disable @typescript-eslint/no-unused-vars */
import { JWT } from "next-auth/jwt"
import NextAuth, { DefaultSession, User } from 'next-auth';

export interface CustomAuthUser extends User {
  id: string;
}

declare module 'next-auth' {
  interface Session {
    user?: CustomAuthUser & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    user?: CustomAuthUser;
  }
}