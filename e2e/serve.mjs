/**
 * Servidor dos testes ponta a ponta: um MongoDB descartável em memória e o build de produção do
 * app (`next start`) apontando para ele. O Playwright sobe este script (playwright.config.ts) e
 * derruba tudo no fim; nada toca o Atlas.
 *
 *   npm run build && npm run test:e2e
 */
import { spawn } from "node:child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const PORT = process.env.E2E_PORT ?? "3100";

// replica set: as exclusões em cascata usam transação
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

const app = spawn("npx", ["next", "start", "-p", PORT], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    MONGODB_URI: mongo.getUri(),
    MONGODB_DB: "project-flow-e2e",
    NEXTAUTH_URL: `http://localhost:${PORT}`,
    NEXTAUTH_SECRET: "e2e-only-secret",
    // sem Resend nos testes: os e-mails (convites, confirmação) vão para o log do servidor
    EMAIL_LOG: "1",
    DEMO_USER_EMAIL: "",
    ANTHROPIC_API_KEY: "",
  },
});

const stop = async () => {
  app.kill();
  await mongo.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
app.on("exit", async (code) => {
  await mongo.stop();
  process.exit(code ?? 0);
});
