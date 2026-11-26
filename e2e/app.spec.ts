import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Roteiro ponta a ponta do produto, no navegador, contra o build de produção (e2e/serve.mjs):
 * cadastro → workspace → projeto → tarefa → comentário → mover → sprint → documento → convite.
 * Cada tela principal também passa pelo axe (acessibilidade, WCAG 2.1 AA).
 */

const stamp = Date.now();
const user = { name: "Pessoa E2E", email: `e2e-${stamp}@teste.dev`, password: "senha-e2e-123" };

/** Falhas sérias de acessibilidade na página atual (ignora avisos menores). */
async function expectAccessible(page: Page, label: string) {
  // no meio de uma entrada animada o texto ainda está transparente e o contraste sai errado:
  // espera as animações com fim (o brilho infinito do esqueleto não conta)
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity)
  );
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`),
    `acessibilidade em ${label}`
  ).toEqual([]);
}

test("página inicial pública e acessível", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Projetos, sprints e documentos");
  await expect(page.getByRole("link", { name: "Criar conta grátis" }).first()).toBeVisible();
  await expectAccessible(page, "página inicial");
});

test("tela do app sem login leva ao login e volta depois", async ({ page }) => {
  await page.goto("/my-work");
  await expect(page).toHaveURL(/\/auth\/login\?callbackUrl=%2Fmy-work/);
  await expectAccessible(page, "login");
});

test("senha errada mostra a mensagem certa", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByLabel("E-mail").fill("ninguem@teste.dev");
  await page.getByLabel("Senha", { exact: true }).fill("senha-errada");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("E-mail ou senha incorretos")).toBeVisible();
});

test("roteiro completo de um time novo", async ({ page }) => {
  await test.step("cadastro", async () => {
    await page.goto("/auth/signup");
    await page.getByLabel("Nome", { exact: true }).fill(user.name);
    await page.getByLabel("E-mail").fill(user.email);
    await page.getByLabel("Senha", { exact: true }).fill(user.password);
    await page.getByLabel("Confirmar senha").fill(user.password);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/\/workspaces$/);
  });

  await test.step("workspace com primeiros passos", async () => {
    await page.getByRole("button", { name: "Novo workspace" }).click();
    await page.getByRole("dialog").getByLabel("Nome").fill("Equipe E2E");
    await page.getByRole("button", { name: "Criar workspace" }).click();
    await expect(page).toHaveURL(/\/w\/equipe-e2e/);
    await expect(page.getByText("Primeiros passos")).toBeVisible();
    await expectAccessible(page, "visão geral do workspace");
  });

  await test.step("projeto e quadro", async () => {
    await page.getByRole("button", { name: "Novo projeto" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome").fill("Portal do Cliente");
    await dialog.getByLabel("Chave").fill("PC");
    await dialog.getByRole("button", { name: "Criar projeto" }).click();
    await expect(page).toHaveURL(/\/projects\/PC$/);
    await expect(page.getByRole("heading", { name: "A Fazer" })).toBeVisible();
  });

  await test.step("tarefa nova entra em A Fazer", async () => {
    await page.getByRole("button", { name: "Nova tarefa" }).first().click();
    await page.getByRole("dialog").getByLabel("Título").fill("Tela de login do portal");
    await page.getByRole("button", { name: "Criar tarefa" }).click();
    const todo = page.getByRole("region", { name: /A Fazer/ });
    await expect(todo.getByRole("link", { name: "Tela de login do portal" })).toBeVisible();
    await expectAccessible(page, "quadro");
  });

  await test.step("comentário com a tarefa aberta", async () => {
    await page.getByRole("link", { name: "Tela de login do portal" }).click();
    const comment = page.getByLabel("Novo comentário");
    await comment.fill("Começo pelo layout amanhã.");
    await page.getByRole("button", { name: "Comentar" }).click();
    await expect(page.getByText("Começo pelo layout amanhã.")).toBeVisible();
    await expect(comment).toHaveValue("");
    await expectAccessible(page, "tarefa");

    // prazo pelo calendário em português: o dia em foco ao abrir é hoje, e Enter o escolhe
    await page.getByRole("button", { name: "Prazo: Sem prazo" }).click();
    await expectAccessible(page, "calendário do prazo");
    await page.keyboard.press("Enter");
    const today = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());
    await expect(page.getByRole("button", { name: `Prazo: ${today}` })).toBeVisible();
    await page.goto(page.url().replace(/\/tasks\/PC-1$/, ""));
    // e o card do quadro mostra o prazo salvo
    await expect(page.getByRole("region", { name: /A Fazer/ }).getByText("hoje")).toBeVisible();
  });

  await test.step("mover pelo menu (alternativa de teclado ao arraste)", async () => {
    await page.getByRole("button", { name: "Mover PC-1" }).click();
    await page.getByRole("menuitem", { name: "Em Andamento" }).click();
    const doing = page.getByRole("region", { name: /Em Andamento/ });
    await expect(doing.getByRole("link", { name: "Tela de login do portal" })).toBeVisible();
  });

  await test.step("sprint planejada e iniciada no backlog", async () => {
    await page.getByRole("link", { name: "Backlog" }).click();
    await page.getByRole("button", { name: "Nova sprint" }).click();
    await page.getByRole("button", { name: "Criar sprint" }).click();
    await page.getByRole("button", { name: "Iniciar sprint" }).click();
    await expect(page.getByText("Ativa").first()).toBeVisible();
  });

  await test.step("documento em Markdown", async () => {
    await page.getByRole("link", { name: "Documentos" }).first().click();
    await page.getByRole("button", { name: "Novo documento" }).first().click();
    // espera o editor abrir: até lá a página anterior ainda está na tela
    await expect(page).toHaveURL(/\/docs\/[0-9a-f]{24}$/);
    await page.locator("#doc-title").fill("Combinados do time");
    await page.locator("#doc-content").fill("# Rituais\n\n- Daily às 9h30");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Salvo")).toBeVisible();
    await page.getByRole("tab", { name: "Visualizar" }).click();
    await expect(page.getByRole("heading", { name: "Rituais" })).toBeVisible();
  });

  await test.step("convite por e-mail", async () => {
    await page.getByRole("link", { name: "Configurações" }).first().click();
    await page.getByRole("tab", { name: "Membros" }).click();
    await page.getByLabel("Convidar pessoa por e-mail").fill(`convidada-${stamp}@teste.dev`);
    await page.getByRole("button", { name: "Convidar" }).click();
    await expect(page.getByText("Convites pendentes (1)")).toBeVisible();
  });

  await test.step("excluir manda para a lixeira e Desfazer devolve", async () => {
    await page.getByRole("link", { name: "Portal do Cliente" }).first().click();
    await page.getByRole("link", { name: "Tela de login do portal" }).click();
    await page.getByRole("button", { name: "Mais ações" }).last().click();
    await page.getByRole("menuitem", { name: "Excluir tarefa" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir tarefa" }).click();
    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(page).toHaveURL(/\/tasks\/PC-1$/);
    await expect(page.getByText("Restaurado.")).toBeVisible();
  });

  await test.step("busca global encontra a tarefa", async () => {
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder("Buscar tarefas, projetos, documentos…").fill("tela de login");
    await expect(page.getByRole("option", { name: /Tela de login do portal/ })).toBeVisible();
  });
});
