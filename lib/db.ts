/**
 *
 *  db.ts
 *  Arquivo que centraliza Singleton de Conexão ao banco de dados
 *  Detalhes da decisão em `docs/adrs/001-singleton-para-conexao-mongodb.md`
 *  conexão via mongoose
 *
 */

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

export const DB_NAME = process.env.MONGODB_DB || "project-flow";

if (!MONGODB_URI)
  throw new Error("Defina MONGODB_URI no .env.local (local) ou nas Environment Variables da Vercel.");

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Na Vercel cada instância de função reaproveita o `global` entre invocações;
// guardar a conexão aqui evita abrir um pool novo no Atlas a cada requisição
const globalForMongoose = global as typeof globalThis & { mongoose?: MongooseCache };
const cached: MongooseCache = (globalForMongoose.mongoose ??= { conn: null, promise: null });

async function dbConnect() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      // A URI criada pela integração Vercel + Atlas não traz o nome do banco; sem isto o Mongo usaria "test"
      dbName: DB_NAME,
      // Funções serverless rodam muitas instâncias em paralelo: um pool pequeno por instância
      // evita estourar o limite de conexões do cluster (o M0 gratuito aceita 500)
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Sem isso, uma falha (Atlas fora do ar, IP bloqueado) ficaria em cache e
    // todas as requisições seguintes falhariam até a instância reiniciar
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

export default dbConnect;
