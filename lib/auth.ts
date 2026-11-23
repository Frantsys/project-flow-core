import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import dbConnect from "./db";
import { User } from "@/server/db/models";
import bcrypt from "bcryptjs";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { MongoClient } from "mongodb";

/**
 *  "Gambiarra" para conseguir um MongoClient a partir da conexão com o MongoDB via mongoose
 *  é necessário e ideal para o adapter do next-auth com MongoDB
 */
const clientPromise = dbConnect().then(
  (mongooseInstance) => mongooseInstance.connection.getClient() as MongoClient
);


export const authOptions: NextAuthOptions = {
    adapter: MongoDBAdapter(clientPromise),
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
                email: { label: "Email", type: "text"},
                password: { label: "Senha", type: "password" }
            },

            async authorize(credentials) {
                await dbConnect();

                const user = await User.findOne({ email: credentials?.email! }).select("+passwordHash");

                if (!user) throw new Error("Credenciais incorretas.");

                const isValid = await bcrypt.compare(credentials!.password, user.passwordHash!);
                if (!isValid) throw new Error("Credenciais incorretas.");

                return { id: user._id.toString(), email: user.email, name: user.username };
            }
        })
    ],
    pages: {
        signOut: "/auth/login",
        error: "/auth/login",
        newUser: "/onboarding"
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.sub!; // Adiciona ID na sessão
            }
            return session;
        }
    }
}