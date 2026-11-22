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

if (!MONGODB_URI ) throw new Error ("Defina MONGODB_URI no .env.local");

let cached = (global as any).mongoose;

if (!cached ) {
    cached = (global as any).mongoose = { conn: null, promise: null };
}


async function dbConnect () {
    if (cached.conn) return cached.conn;

    if (!cached.promise ) {
        cached.promise = mongoose.connect(MONGODB_URI, {
            bufferCommands: false
        }).then((mongoose) => mongoose);
    }
    cached.conn = await cached.promise ;
    return cached.conn;
}

export default dbConnect;