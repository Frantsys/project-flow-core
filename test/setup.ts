import { afterAll, afterEach, beforeAll, inject, vi } from "vitest";

// lib/db.ts lê estas variáveis ao ser importado: precisam existir antes de qualquer import do app
process.env.MONGODB_URI = inject("mongoUri");
process.env.MONGODB_DB = "project-flow-test";
process.env.NEXTAUTH_SECRET = "test-secret";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }));

// o limite de tentativas lê o IP dos cabeçalhos da requisição
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }) }));

// a sessão vem do getServerSession: os testes trocam o usuário logado com actAs() (test/helpers.ts)
vi.mock("next-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-auth")>()),
  getServerSession: vi.fn(async () => {
    const { currentUserId, currentIsDemo } = await import("./session-state");
    return currentUserId() ? { user: { id: currentUserId(), demo: currentIsDemo() } } : null;
  }),
}));

beforeAll(async () => {
  const { default: dbConnect } = await import("@/lib/db");
  const mongoose = await dbConnect();
  // cria os índices (únicos de e-mail, chave de projeto, código de tarefa) antes dos testes
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
});

afterEach(async () => {
  const { default: dbConnect } = await import("@/lib/db");
  const mongoose = await dbConnect();
  const { actAs } = await import("./session-state");
  actAs(null);
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  const { default: mongoose } = await import("mongoose");
  await mongoose.disconnect();
  // o dbConnect guarda a conexão em global: limpa para o próximo arquivo reconectar
  (global as { mongoose?: unknown }).mongoose = undefined;
});
