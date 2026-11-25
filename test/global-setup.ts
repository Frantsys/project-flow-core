import { MongoMemoryReplSet } from "mongodb-memory-server";

let replSet: MongoMemoryReplSet | undefined;

/**
 * Sobe um MongoDB em memória com replica set (necessário para as transações usadas em
 * exclusões em cascata e na conclusão de sprint, como no Atlas) e expõe a URI aos testes.
 */
export async function setup({ provide }: { provide: (key: "mongoUri", value: string) => void }) {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  provide("mongoUri", replSet.getUri());
}

export async function teardown() {
  await replSet?.stop();
}

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
