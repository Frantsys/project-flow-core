import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // "server-only" lança erro fora do servidor do Next; nos testes ele não tem papel
    alias: { "server-only": fileURLToPath(new URL("./test/stubs/empty.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    // e2e/ roda no Playwright, não no Vitest
    exclude: [...configDefaults.exclude, "e2e/**"],
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    // um só MongoDB em memória para todos os arquivos: rodar em sequência evita um teste apagar dados de outro
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
