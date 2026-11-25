import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import dbConnect, { DB_NAME } from "./db";
import { User } from "@/server/db/models";
import bcrypt from "bcryptjs";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { MongoClient } from "mongodb";

/**
 *  Cliente próprio do driver `mongodb` para o adapter do NextAuth.
 *  O adapter é feito para o driver 6, e o mongoose 9 usa o driver 7: entregar o cliente do mongoose
 *  ao adapter quebrava o cadastro via Google/GitHub com "Unsupported BSON version".
 *  É criado só quando o adapter precisa e fica em `global` para ser reaproveitado entre
 *  invocações da função; se a conexão falhar, a próxima tentativa cria outra.
 */
const globalForMongo = global as typeof globalThis & { _adapterClient?: Promise<MongoClient> };

function getMongoClient() {
  globalForMongo._adapterClient ??= new MongoClient(process.env.MONGODB_URI!, { maxPoolSize: 5 })
    .connect()
    .catch((error) => {
      globalForMongo._adapterClient = undefined;
      throw error;
    });
  return globalForMongo._adapterClient;
}

export const authOptions: NextAuthOptions = {
  // databaseName: sem ele o adapter usaria o banco da URI ("test") e as contas OAuth ficariam separadas
  adapter: MongoDBAdapter(getMongoClient, { databaseName: DB_NAME }),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Senha", type: "password" },
      },

      async authorize(credentials) {
        await dbConnect();

        if (!credentials?.email || !credentials.password) throw new Error("Credenciais incorretas.");

        const user = await User.findOne({ email: credentials.email }).select("+passwordHash");

        if (!user) throw new Error("Credenciais incorretas.");

        // contas criadas via Google/GitHub não têm senha
        if (!user.passwordHash) throw new Error("Credenciais incorretas.");

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) throw new Error("Credenciais incorretas.");

        return { id: user._id.toString(), email: user.email, name: user.username };
      },
    }),
  ],
  pages: {
    // sem signIn, erros de OAuth caíam na página padrão do NextAuth, em inglês
    signIn: "/auth/login",
    signOut: "/auth/login",
    error: "/auth/login",
    newUser: "/workspaces",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  events: {
    // O adapter grava o nome em `name`, mas o app lê `username` (model User).
    // Copia na criação para contas do Google/GitHub não aparecerem sem nome.
    async createUser({ user }) {
      await dbConnect();
      await User.updateOne(
        { _id: user.id },
        { $set: { username: user.name || user.email?.split("@")[0] || "Usuário" } }
      );
    },
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!; // Adiciona ID na sessão
      }
      return session;
    },
  },
};
