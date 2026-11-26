import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import dbConnect, { DB_NAME } from "./db";
import { User } from "@/server/db/models";
import bcrypt from "bcryptjs";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { MongoClient } from "mongodb";
import { fetchGitHubEmails, isVerifiedOAuthEmail } from "./oauth-email";
import { ipFrom, rateLimit, tooManyAttemptsMessage } from "@/server/lib/rate-limit";
import { checkSecondFactor } from "@/server/lib/two-factor";

export const TWO_FACTOR_REQUIRED = "TWO_FACTOR_REQUIRED";

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
      // vincular pelo e-mail é seguro aqui porque o callback signIn recusa e-mail não verificado
      allowDangerousEmailAccountLinking: true,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    // "Ver demonstração": entra sem senha na conta demo pública (DEMO_USER_EMAIL), em modo só leitura.
    // Sem a variável, o provedor recusa; o domínio fixo impede apontar para uma conta real.
    CredentialsProvider({
      id: "demo",
      name: "Demonstração",
      credentials: {},
      async authorize() {
        const email = process.env.DEMO_USER_EMAIL;
        if (!email?.endsWith("@demo.projectflow.dev")) return null;
        await dbConnect();
        const user = await User.findOne({ email }).select("_id email username").lean();
        return user ? { id: user._id.toString(), email: user.email, name: user.username } : null;
      },
    }),

    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Senha", type: "password" },
        // segundo passo do login, só para contas com verificação em duas etapas
        code: { label: "Código", type: "text" },
      },

      async authorize(credentials, req) {
        await dbConnect();

        if (!credentials?.email || !credentials.password) throw new Error("Credenciais incorretas.");

        // 5 tentativas a cada 15 min por IP + e-mail: freia força bruta sem travar a conta para outros IPs
        const forwarded = req?.headers?.["x-forwarded-for"] as string | undefined;
        const limit = await rateLimit(
          `login:${ipFrom(forwarded)}:${credentials.email.toLowerCase()}`,
          5,
          15 * 60_000
        );
        if (!limit.allowed) throw new Error(tooManyAttemptsMessage(limit.retryAfterSeconds));

        const user = await User.findOne({ email: credentials.email }).select("+passwordHash");

        if (!user) throw new Error("Credenciais incorretas.");

        // contas criadas via Google/GitHub não têm senha
        if (!user.passwordHash) throw new Error("Credenciais incorretas.");

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) throw new Error("Credenciais incorretas.");

        if (user.twoFactorEnabled) {
          // o formulário mostra o campo do código ao receber este erro e envia tudo de novo
          if (!credentials.code) throw new Error(TWO_FACTOR_REQUIRED);
          if (!(await checkSecondFactor(user._id, credentials.code))) {
            throw new Error("Código de verificação incorreto.");
          }
        }

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
        {
          $set: {
            username: user.name || user.email?.split("@")[0] || "Usuário",
            // o adapter só cria contas vindas do Google/GitHub, e o callback signIn já exigiu e-mail verificado
            emailVerified: new Date(),
          },
        }
      );
    },
  },
  callbacks: {
    async signIn({ account, profile, user }) {
      // e-mail e senha e a demonstração não passam por provedor externo: nada a verificar aqui
      if (!account || account.type === "credentials") return true;

      const verified = isVerifiedOAuthEmail({
        provider: account.provider,
        email: user.email,
        googleEmailVerified: (profile as { email_verified?: unknown } | undefined)?.email_verified,
        githubEmails:
          account.provider === "github" && account.access_token
            ? await fetchGitHubEmails(account.access_token)
            : undefined,
      });

      if (!verified) return "/auth/login?error=EmailNotVerified";

      // conta antiga com senha que agora entra pelo provedor: o e-mail ficou comprovado
      if (user.email) {
        await dbConnect();
        await User.updateOne(
          { email: user.email.toLowerCase(), emailVerified: null },
          { $set: { emailVerified: new Date() } }
        );
      }
      return true;
    },
    async jwt({ token, trigger, session, account }) {
      // no login: lembra se a sessão é da demonstração (o bloqueio de escrita usa isso)
      if (account) token.demo = account.provider === "demo";

      // A sessão é um JWT, que não se apaga no servidor. Para encerrar sessões, o usuário tem uma
      // versão: o token guarda a do login e cada leitura confere com o banco (uma consulta por _id).
      if (token.sub) {
        await dbConnect();
        const current = await User.findById(token.sub).select("sessionVersion").lean();
        const version = current?.sessionVersion ?? 0;
        if (account) token.sv = version;
        else if (!current || version !== (token.sv ?? 0)) token.revoked = true;
      }
      // useSession().update({ name }) depois de editar o perfil em Minha conta
      if (trigger === "update" && typeof session?.name === "string") token.name = session.name;
      return token;
    },
    async session({ session, token }) {
      // sessão encerrada (troca de senha, outro dispositivo) ou conta excluída: fica sem usuário
      if (token.revoked) return { expires: session.expires };
      if (session.user) {
        session.user.id = token.sub!; // Adiciona ID na sessão
        session.user.demo = !!token.demo;
      }
      return session;
    },
  },
};
