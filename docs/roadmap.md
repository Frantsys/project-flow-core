# Project Flow — Plano de upgrade para nível profissional

## Contexto

O Project Flow já funciona de ponta a ponta em produção: autenticação (e-mail/senha, Google, GitHub), workspaces, projetos, quadro kanban, backlog com sprints, tarefa completa (campos, subtarefas, comentários, histórico), documentos em árvore, membros com papéis e histórico do workspace. Stack: Next.js 16 (App Router, Cache Components, Server Actions), NextAuth v4, Mongoose 9 + MongoDB Atlas M0, shadcn/ui + Tailwind v4, Vercel Hobby.

**Objetivo definido com você:** portfólio / TCC de alto nível, mostrando engenharia e produto no padrão de uma empresa grande, **só com serviços gratuitos** (itens pagos ficam marcados como "futuro").

O que separa o projeto de um produto profissional hoje não é falta de telas, e sim:

1. **Zero testes e zero CI.** Nada impede uma regressão de ir para produção.
2. **Ambientes misturados.** Preview e desenvolvimento local usam o banco de produção.
3. **Lacunas de segurança.** Sem limite de tentativas de login, sem verificação de e-mail ou recuperação de senha, e vinculação automática de contas OAuth (`allowDangerousEmailAccountLinking`).
4. **Modelagem que limita o produto.** Status são texto livre (renomear quebra tarefas; "concluído" = último status da lista), não há ordenação das tarefas na coluna, comentários e subtarefas crescem sem limite dentro do documento da tarefa, e o tipo Épico existe nos tipos TypeScript mas não no model (`server/db/models.ts:223`).
5. **Boilerplate repetido.** Cada action repete sessão + zod + permissão + try/catch, e há imports errados de zod (`@/node_modules/zod/...` em `server/actions/auth.actions.ts:8` e `project.actions.ts:13`).
6. **Recursos que um produto desse tipo tem e este não:** arrastar e soltar, filtros, busca global, notificações, tempo real, convites por e-mail, relatórios, Markdown renderizado, modo escuro, página pública, "Minhas tarefas".

O plano abaixo é dividido em **10 fases**, na ordem em que devem ser feitas: cada fase destrava a seguinte. Cada etapa diz o que fazer, onde, e como saber que terminou.

Legenda de esforço: **P** (até meio dia) · **M** (1–2 dias) · **G** (3–5 dias).

---

## Fase 0 — Fundações de engenharia (fazer antes de tudo)

Sem isso, cada fase seguinte é feita às cegas.

### 0.1 Separar ambientes (P) — prioridade máxima

- Criar no Atlas (mesmo cluster M0 gratuito) os bancos `project-flow-dev` e `project-flow-preview`; produção continua `project-flow`.
- Na Vercel: `MONGODB_DB=project-flow-preview` só no ambiente _Preview_; `.env.local` local com `MONGODB_DB=project-flow-dev`.
  - `lib/db.ts` já lê `MONGODB_DB` (`DB_NAME`); o adapter do NextAuth em `lib/auth.ts` também usa `DB_NAME`, então não há mudança de código.
- **Pronto quando:** criar uma conta rodando localmente não aparece no banco de produção.

### 0.2 Ligar a Vercel ao GitHub (P)

- Instalar o app da Vercel na conta Frantsys e conectar `Frantsys/project-flow-core` (Settings › Git).
- Cada PR ganha um deploy de preview; a `main` publica em produção automaticamente.
- Proteger a `main` no GitHub: exigir PR e checks verdes (0.4).

### 0.3 Qualidade de código automatizada (P)

- Prettier + `prettier-plugin-tailwindcss`; `lint-staged` + `husky` (pre-commit: lint e formatação nos arquivos alterados).
- `commitlint` com Conventional Commits (o projeto já usa `feat(...)`/`fix(...)`).
- Ativar `noUncheckedIndexedAccess` no `tsconfig.json` e corrigir o que aparecer.
- Corrigir os imports de zod em `auth.actions.ts` e `project.actions.ts` para `import { z } from "zod"`, e trocar `parsed.error.flatten()` (`project.actions.ts:130`, API depreciada) por `z.flattenError`.

### 0.4 Testes e CI (G)

- **Unitários e de integração:** Vitest + `mongodb-memory-server` (Mongo em memória com replica set, para as transações).
  - Começar pelo que tem regra: `verifyWorkspacePermission`, `createTaskAction` (código sequencial e concorrência), `updateTaskAction` (cada campo, responsável não-membro, sprint de outro projeto), `completeSprintAction` (destino das tarefas abertas), `removeMemberAction` / `updateMemberRoleAction` (matriz de permissões), `deleteDocumentAction` (subárvore), `deleteWorkspace` (cascata), `describeHistory` e `suggestKey`.
  - Para chamar actions nos testes, isolar a leitura de sessão num `getSessionUserId()` mockável (ver 2.1).
- **E2E:** Playwright cobrindo o roteiro que você usou para testar: cadastro → workspace → projeto → tarefa → sprint → documento → convite de membro. Incluir `@axe-core/playwright` para acessibilidade.
- **GitHub Actions:** `typecheck` → `lint` → `vitest` → `next build` → Playwright contra o preview.
- **Pronto quando:** um PR que quebre uma regra de permissão fica vermelho.

### 0.5 Seed e dados de demonstração (P)

- `scripts/seed.ts` cria um workspace "Acme Labs" com 3 projetos, 40 tarefas, sprints, documentos e histórico, só no banco `-dev`/`-preview`.
- Para portfólio, permite um **modo demonstração** público (Fase 9.3) sem expor dados reais.

### 0.6 README e documentação (P)

- Trocar o README do `create-next-app` por um README de produto: o que é, prints, arquitetura (diagrama), stack, como rodar, variáveis (`.env.example` já existe), decisões (ADRs em `docs/adrs`).
- Novas ADRs para as decisões deste plano: status como entidade, ordenação fracionária, tempo real, wrapper de actions, Auth.js v5.

---

## Fase 1 — Segurança e contas

### 1.1 Migrar NextAuth v4 → Auth.js v5 (M)

- A v4 está em manutenção, e a v5 tem integração nativa com o App Router (`auth()` em vez de `getServerSession(authOptions)`).
- Arquivos afetados:
  - `lib/auth.ts` → `auth.ts` na raiz, exportando `handlers`, `auth`, `signIn`, `signOut`;
  - `app/api/auth/[...nextauth]/route.ts`;
  - `proxy.ts`;
  - `lib/session.ts` (`requireUser`);
  - todas as actions, que trocam `getServerSession`.
- Manter o adapter com cliente `mongodb` próprio (já corrigido em `lib/auth.ts`) e o `createUser` que copia `name` → `username`.

### 1.2 Vinculação de contas segura (P)

- Remover `allowDangerousEmailAccountLinking: true` (`lib/auth.ts:38,43`). Com ela, quem controla um GitHub com um e-mail **não verificado** igual ao seu entra na sua conta.
- No lugar: vincular só se o provedor afirmar que o e-mail é verificado (callback `signIn` checando `profile.email_verified` no Google e o e-mail primário verificado no GitHub). Caso contrário, mostrar a mensagem `OAuthAccountNotLinked`, que já existe em `components/auth/login-form.tsx`.
- Adicionar em "Conta" (1.5) a opção "Conectar Google/GitHub" estando logado.

### 1.3 Verificação de e-mail e recuperação de senha (M)

- E-mail transacional com **Resend** (gratuito: 3.000 e-mails/mês) + **React Email** para os templates.
- Collection `VerificationToken` (o adapter já cria `verification_tokens`).
- Fluxos:
  - **Cadastro:** cria a conta → envia link de verificação.
  - **Esqueci a senha:** página `/auth/forgot` → link de uso único válido por 30 min → página `/auth/reset`.
- Bloquear ações sensíveis (convidar, excluir workspace) até verificar o e-mail.

### 1.4 Proteção contra abuso (M)

- **Limite de tentativas:** Upstash Redis + `@upstash/ratelimit` (gratuito: 10k comandos/dia).
  - Login: 5 tentativas a cada 15 min por IP + e-mail.
  - Cadastro, "esqueci a senha" e convite: 3 por hora por IP.
  - Server actions de escrita: 60 por minuto por usuário.
- **Senha:** checar contra senhas vazadas (Have I Been Pwned, API k-anonymity gratuita) e mostrar um medidor de força no cadastro.
- **Cabeçalhos de segurança** em `next.config.ts`: Content-Security-Policy (com nonce), `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. Verificar a nota em securityheaders.com (meta: A).

### 1.5 Página "Minha conta" (M)

- `/account` com:
  - perfil: nome e foto (upload em 6.4);
  - e-mail (com nova verificação);
  - trocar senha;
  - contas conectadas;
  - sessões;
  - excluir a conta (LGPD: apagar ou anonimizar os dados, transferindo ou bloqueando se for dono de workspace);
  - exportar meus dados (JSON).
- Hoje não há onde mudar o nome: `username` só é definido no cadastro.

### 1.6 Autenticação em dois fatores (M, opcional para portfólio)

- TOTP com `otplib` + QR code; códigos de recuperação com hash. É um diferencial que pouco portfólio tem.

### 1.7 Matriz de permissões centralizada (M)

- Hoje as regras estão espalhadas:
  - `allowedRoles` em cada action;
  - `canManage` / `canPlan` nas páginas;
  - `canEditRole` em `components/workspaces/member-management.tsx`.
- Criar `server/auth/permissions.ts` com `can(role, action)`, por exemplo `can("ADMIN", "sprint.start")`. Usar a mesma função no servidor (actions) e para esconder botões no cliente.
- Adicionar o papel **Convidado** (só leitura), comum em produtos grandes.
- Teste de tabela cobrindo todas as combinações papel × ação.

### 1.8 Rotação de segredos (P)

- Confirmar que os segredos OAuth que passaram pelo chat foram trocados.
- Documentar em `docs/deploy.md` como fazer a rotação (OAuth e `NEXTAUTH_SECRET`).

---

## Fase 2 — Arquitetura do backend

### 2.1 Wrapper único para server actions (M)

- Criar `server/lib/action.ts` com `createAction({ schema, permission?, handler })`, que concentra:
  - leitura da sessão;
  - validação com zod;
  - checagem de permissão;
  - try/catch;
  - log estruturado;
  - formato `ActionResult` de `types.ts`.
- As actions encolhem para algo como:
  ```ts
  export const startSprintAction = createAction({
    schema: sprintIdSchema,
    load: loadSprint,
    permission: "sprint.start",
    handler: …,
  });
  ```
- Migrar todas: `server/actions/*.actions.ts`. Hoje são cerca de 15 cópias do mesmo bloco, e já existe uma versão parcial desse padrão em `loadTask` (`task.actions.ts`).

### 2.2 Camada de acesso a dados (DAL) (M)

- Padrão recomendado pelo Next: `server/data/*.ts` com `import "server-only"`, que recebem o usuário e devolvem DTOs. Juntar aqui o que hoje está em `server/services/*` e em `lib/session.ts` (`getWorkspace`, `getDocuments`).
- Um só lugar resolve "workspace pelo slug + checar que é membro". Hoje isso se repete em `project.service.ts`, `task.service.ts`, `document.service.ts` e `history.service.ts`.
- Mappers de DTO em arquivos próprios (`toTaskDTO`, `toPersonDTO`). Hoje `person()` existe só em `task.service.ts`.

### 2.3 Decidir o destino das API Routes (P)

- `app/api/workspaces/**` duplica os services e nenhuma tela usa essas rotas. Opções: removê-las, ou transformá-las numa **API pública versionada** `/api/v1`, com tokens de API por workspace e documentação OpenAPI (zod-to-openapi + Scalar).
- Para portfólio, a API pública documentada é um diferencial: recomendo a segunda opção, numa fase posterior (8.6).

### 2.4 Cache com tags em vez de `revalidatePath` (M)

- Usar `"use cache"` + `cacheTag("workspace:{id}")`, `cacheTag("project:{id}")` e `cacheTag("task:{id}")` nas leituras da DAL, e `updateTag` / `revalidateTag` nas actions.
- Isso substitui os `revalidatePath(".../[projectKey]", "layout")`, que invalidam mais do que o necessário.
- Ler `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` antes (regra do AGENTS.md).
- **Pronto quando:** abrir o quadro duas vezes seguidas não consulta o Mongo na segunda vez.

### 2.5 Logs, erros e auditoria (M)

- Logger estruturado (`pino`) com `requestId`, `userId` e `workspaceId` em toda action.
- **Sentry** (gratuito: 5k erros/mês) no servidor e no cliente, com source maps.
- Os logs da Vercel Hobby duram só 30 minutos: enviar para o **Axiom** ou o **Better Stack** (cotas gratuitas) por log drain.

### 2.6 Jobs agendados (P)

- **Vercel Cron** (gratuito no Hobby, 1 execução por dia por job):
  - aviso de prazo amanhã (alimenta 5.2);
  - limpeza de tokens expirados;
  - snapshot diário de métricas da sprint (alimenta os relatórios 4.7).

---

## Fase 3 — Modelagem e lógica de domínio

Estas mudanças precisam de migração de dados: usar `migrate-mongo` com scripts versionados em `migrations/`, testados contra o seed.

### 3.1 Status como entidade (G) — a mudança de domínio mais importante

- Hoje: `Project.statuses: string[]`, a tarefa guarda o **nome** do status, e "concluído" é inferido como o último item da lista (`completeSprintAction`).
- Novo modelo:
  ```
  Project.statuses: [{ _id, name, category: "TODO" | "IN_PROGRESS" | "DONE", color, order }]
  Task.statusId: ObjectId
  ```
- Ganhos:
  - renomear um status não quebra as tarefas;
  - "concluído" vira `category === "DONE"`;
  - permite vários status de conclusão ("Concluído", "Cancelado");
  - cores por status no quadro.
- Tela em Configurações do projeto: adicionar, renomear, reordenar (arrastar), mudar a categoria e excluir, movendo as tarefas antes de excluir.
- Migração: criar os status a partir das strings atuais e preencher `statusId` em cada tarefa.

### 3.2 Ordem das tarefas na coluna (M)

- Campo `rank: string` com indexação fracionária (pacote `fractional-indexing`): mover uma tarefa reescreve um único documento.
- Índice `{ projectId: 1, statusId: 1, rank: 1 }`.
- Pré-requisito do arrastar e soltar (4.1).

### 3.3 Épicos e hierarquia (M)

- Alinhar o enum do model (`server/db/models.ts:223`) com `TaskType` (incluir `EPIC`).
- `Task.parentId` para ligar tarefas a um épico, e a tela do épico mostra o progresso das filhas.
- Relações entre tarefas: `bloqueia`, `é bloqueada por`, `duplica`, `relacionada`. Collection `TaskLink` ou array com índice.

### 3.4 Comentários e subtarefas fora do documento da tarefa (M)

- Hoje ficam embutidos em `Task` e crescem sem limite (teto de 16 MB por documento, e a tarefa inteira é relida a cada mudança).
- Mover comentários para a collection `Comment` (paginada, editável, com `editedAt`), com suporte a **@menções** (5.1) e reações.
- Subtarefas podem continuar embutidas, mas com limite de 100 no schema.

### 3.5 Etiquetas, anexos e campos extras (M)

- `Task.tags` existe mas não tem interface: criar etiquetas por workspace (`Label { name, color }`), com filtro e cor nos cards.
- **Anexos** via **Vercel Blob** (gratuito: 1 GB) ou UploadThing: imagens e PDFs na tarefa e no documento. Validar tipo e tamanho no servidor.
- Estimativa e tempo gasto (opcional): registro de horas por tarefa.

### 3.6 Membros e posse do workspace (M)

- Hoje `ownerId` e `members[].role = "OWNER"` guardam a mesma informação. Manter só o papel no membro, e `ownerId` como índice derivado ou remover.
- **Transferir a posse** do workspace (o dono atual vira Admin).
- **Convites por e-mail com token** (collection `Invitation { email, role, token, expiresAt, invitedBy }`), substituindo o atalho em `member.actions.ts` que exige a pessoa já ter conta. Mostrar a lista de convites pendentes, com reenviar e cancelar.
- Ao remover um membro, oferecer: reatribuir as tarefas dele, ou deixá-las sem responsável.

### 3.7 Concorrência e consistência (M)

- **Documentos:** controle otimista por versão (`__v` ou `updatedAt` enviado no save; recusar se mudou). Mostrar "Alguém editou este documento. Recarregar / Comparar". Hoje o último a salvar sobrescreve o outro sem aviso.
- **Tarefas:** mesma proteção para a descrição.
- **Exclusão de projeto:** já usa transação. Aplicar o mesmo cuidado a `deleteDocumentAction` (subárvore) e a `completeSprintAction` (atualiza tarefas e sprint em duas escritas).

### 3.8 Histórico com retenção e índices (P)

- Índice TTL opcional em `ChangeHistory` (ex.: 1 ano) para o M0 não encher (512 MB). Paginação por cursor em `getWorkspaceHistory`.
- Revisar índices com o Atlas Performance Advisor (gratuito no M0).
  - Prováveis: `Task { projectId, assigneeId }`, `Task { projectId, sprintId }`, `Document { workspaceId, parentDocId }`.

### 3.9 Slug do workspace editável (P)

- Hoje o slug tem sufixo aleatório e é fixo. Permitir editar, com checagem de disponibilidade e redirecionamento do slug antigo (collection `SlugRedirect`) para não quebrar links.

---

## Fase 4 — Funcionalidades de produto (frontend + backend)

### 4.1 Arrastar e soltar no quadro (G)

- `@dnd-kit/core` + `@dnd-kit/sortable`, com sensores de teclado: acessível, que é o diferencial em relação à maioria dos clones de kanban.
- Atualização otimista com `useOptimistic`: o card muda de coluna na hora e volta se o servidor recusar (com toast).
- Usa `rank` (3.2) e `statusId` (3.1). Manter o menu "Mover para…" como alternativa.
- Limite WIP por coluna (opcional): aviso visual quando passar do limite.

### 4.2 Filtros, busca e visões salvas (G)

- Barra de filtros no quadro e no backlog: responsável ("Minhas"), prioridade, tipo, etiqueta, sprint, prazo (vencidas / esta semana) e texto.
- Estado na URL com **`nuqs`**, para filtros compartilháveis por link.
- **Visões salvas** por usuário (ex.: "Bugs urgentes").
- **Agrupar por** responsável ou prioridade (swimlanes) no quadro.

### 4.3 Busca global e paleta de comandos (M)

- shadcn `Command` (cmdk) no Ctrl/⌘ K, que já aparece no Design System.
- Busca em tarefas (código e título), projetos, documentos e pessoas.
- Backend: **Atlas Search** (disponível no M0) com índice de texto em `tasks.title`, `tasks.code` e `documents.title/content`. Alternativa simples: índice `$text`.
- Ações rápidas na paleta: "Nova tarefa", "Ir para projeto…", "Trocar workspace", "Alternar tema".

### 4.4 Atalhos de teclado (P)

- Atalhos:
  - `C`: nova tarefa;
  - `/`: buscar;
  - `G` depois `B`: quadro;
  - `G` depois `L`: backlog;
  - `J` e `K`: navegar entre cards;
  - `E`: editar;
  - `?`: abre um diálogo com a lista de atalhos.
- Mostrar o atalho ao lado de cada ação nos menus (padrão de produtos como Linear e GitHub).

### 4.5 "Minhas tarefas" e página inicial pós-login (M)

- `/my-work`: tarefas atribuídas a mim em todos os workspaces, agrupadas em "Atrasadas", "Hoje", "Esta semana" e "Sem prazo".
- Depois do login, ir para "Minhas tarefas" (ou para o último workspace visitado, guardado em cookie) em vez da lista de workspaces.

### 4.6 Visões adicionais do projeto (G)

- **Lista:** tabela ordenável e editável inline (TanStack Table + shadcn Table).
- **Calendário:** tarefas por prazo (mês e semana).
- **Roadmap:** épicos numa linha do tempo, por datas das sprints e prazos.
- As visões compartilham os mesmos filtros (4.2).

### 4.7 Relatórios e métricas (M)

- Gráficos com shadcn Chart (Recharts):
  - burndown da sprint (usa o snapshot diário de 2.6);
  - velocidade das últimas 6 sprints;
  - diagrama de fluxo cumulativo;
  - tarefas por responsável e por prioridade;
  - tempo de ciclo (precisa registrar quando a tarefa entra em uma categoria DONE).
- Página "Relatórios" por projeto e um resumo na Visão geral do workspace.

### 4.8 Documentos de nível profissional (G)

- Trocar a `Textarea` por um editor rico **Tiptap**:
  - Markdown de entrada e saída;
  - títulos, listas, checklists, código com destaque, tabelas, imagens (via 3.5);
  - menu de barra (`/`) e @menções a pessoas e tarefas (links `PF-12` viram cards).
- Renderização segura: sanitizar o HTML (`rehype-sanitize` / DOMPurify) contra XSS.
- **Versões do documento:** collection `DocumentVersion` com snapshot a cada salvamento significativo. Tela "Histórico de versões" com diff e restauração.
- Mover documento na árvore (arrastar) e entre projetos. Documentos favoritos.
- Edição simultânea em tempo real (Yjs + Liveblocks, cota gratuita): futuro.

### 4.9 Templates (M)

- Templates de projeto ("Scrum", "Kanban simples", "Bugs"), com status, etiquetas e documentos iniciais.
- Templates de tarefa (ex.: bug report com passos para reproduzir).

### 4.10 Onboarding (M)

- Primeiro acesso:
  - criar workspace;
  - convidar o time;
  - criar o primeiro projeto a partir de um template;
  - checklist de primeiros passos na Visão geral, que some quando completo.
- Estados vazios ensinando o próximo passo. Os componentes `Empty` já estão em uso; revisar todos.

---

## Fase 5 — Colaboração: notificações e tempo real

### 5.1 Notificações no app (G)

- Collection `Notification { userId, type, actorId, targetType, targetId, readAt }`.
- Gatilhos:
  - fui atribuído;
  - mencionado (@) num comentário ou documento;
  - comentaram numa tarefa que sigo;
  - prazo amanhã (cron 2.6);
  - adicionado a um workspace.
- "Seguir" tarefa: criador, responsável e quem comentou seguem automaticamente.
- Caixa de entrada: ícone de sino com contador na sidebar e página `/inbox` com "marcar como lida", filtros e "marcar todas".

### 5.2 Notificações por e-mail (M)

- Resend + React Email (já configurado em 1.3).
- Preferências por tipo de notificação em "Minha conta". Resumo diário opcional, em vez de um e-mail por evento.
- Link "Cancelar inscrição" em todos os e-mails.

### 5.3 Atualização em tempo real (M)

- **Pusher Channels** (gratuito: 200 mil mensagens/dia, 100 conexões) ou **Ably** (gratuito). Na Vercel, WebSocket próprio não é viável.
- Canais privados por projeto (`private-project-{id}`), autorizados por um endpoint que checa se o usuário é membro.
- As actions publicam `task.updated` / `task.created`; o quadro aplica a mudança sem recarregar.
- Indicador de presença: avatares de quem está vendo o quadro ou a tarefa.
- Fallback sem tempo real: `router.refresh()` quando a aba volta ao foco.

---

## Fase 6 — Frontend, UX e acessibilidade

### 6.1 Formulários padronizados (M)

- Hoje cada formulário repete `useState` de erros e `FormData` manual (`create-task-dialog.tsx`, `create-project-dialog.tsx`, `signup-form.tsx`…). O `react-hook-form` está instalado e sem uso.
- Padronizar: `react-hook-form` + `@hookform/resolvers/zod` + os componentes `Field` do shadcn, com os **mesmos schemas** de `server/schemas.ts` validando no cliente e no servidor.
- Um hook `useActionForm(action, schema)` que aplica os `fieldErrors` do servidor nos campos.

### 6.2 Atualização otimista e feedback (M)

- `useOptimistic` em todas as ações frequentes: mudar status, marcar subtarefa, comentar, mudar responsável. Hoje cada clique espera o servidor e depois faz `router.refresh()` (`components/tasks/task-detail.tsx`).
- "Desfazer" no toast após excluir tarefa, comentário ou documento (exclusão adiada por 5 s, ou lixeira 6.3).

### 6.3 Lixeira (M)

- Exclusão suave (`deletedAt`) em tarefas, documentos e projetos, com restauração por 30 dias na página "Lixeira" do workspace. Purga definitiva por cron.
- Padrão de produtos grandes: reduz o impacto de exclusões acidentais.

### 6.4 Imagens: avatar e logo do workspace (P)

- Upload de avatar e logo (Vercel Blob), com corte quadrado e redimensionamento no cliente. `next/image` com `remotePatterns` para Google, GitHub e Blob.

### 6.5 Modo escuro (P)

- `next-themes` já está instalado (o `Toaster` usa). Adicionar `ThemeProvider` em `app/layout.tsx` e o alternador no menu da conta e na paleta de comandos.
- Revisar os tokens `.dark` de `app/globals.css`, que vieram do shadcn e nunca foram vistos nas telas. Checar contraste 4.5:1 com o axe (0.4).

### 6.6 Páginas de erro, carregamento e 404 (P)

- `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` e `error.tsx` por segmento (workspace, projeto, documento), com mensagens em português e botão "Tentar de novo". Hoje os erros caem nas páginas padrão do Next.
- `loading.tsx` só onde fizer sentido. Os Skeletons dentro de `<Suspense>` já existem.

### 6.7 Responsividade e mobile (M)

- Quadro no celular: colunas em carrossel com abas por status, em vez de rolagem horizontal.
- Painel da tarefa em tela cheia no celular.
- Tabelas (backlog, membros) viram lista de cards abaixo de 640 px.
- **PWA:** `manifest.ts`, ícones e instalação na tela inicial (o Next tem suporte nativo; ler `02-guides/progressive-web-apps.md`).

### 6.8 Acessibilidade WCAG 2.2 AA (M)

- axe no Playwright (0.4) em todas as telas.
- Testar navegação só por teclado: quadro, painel, menus e arrastar (4.1).
- Anúncios para leitor de tela (`aria-live`) ao mover tarefas e salvar.
- `prefers-reduced-motion` nas animações. Foco visível consistente.

### 6.9 Internacionalização (M, opcional)

- `next-intl` com pt-BR (padrão) e en. Os textos já estão centralizados em parte (`lib/labels.ts`, `lib/history-format.ts`); extrair o resto.
- Datas e números com `Intl`, como `fullDate` e `timeAgo` já fazem.

### 6.10 Refinamento visual (M)

- Revisar todas as telas contra o Design System publicado (`Project Flow Design System` no claude.ai). Atualizar o sistema com os componentes novos (Sheet, Command, Table, Toast, Empty).
- Micro-interações:
  - transição do card ao mover;
  - painel deslizando;
  - View Transitions do Next entre quadro e backlog (`02-guides/view-transitions.md`).
- Ícones e cores por projeto (escolhidos na criação), aparecendo na sidebar e nos cards.

---

## Fase 7 — Performance

### 7.1 Medir antes de otimizar (P)

- **Vercel Speed Insights + Web Analytics** (gratuitos no Hobby).
- Meta: LCP < 2,5 s e INP < 200 ms no quadro com 200 tarefas (gerar com o seed 0.5).

### 7.2 Banco (M)

- `getProjectByKey` faz 3 a 4 consultas em sequência. Juntar workspace + projeto numa consulta e usar o cache (2.4).
- Projeções mínimas (`.select`) em todas as listas. Paginação por cursor no backlog e no histórico.
- Quadro com muitas tarefas: carregar as tarefas `DONE` só dos últimos 14 dias, com "ver mais".

### 7.3 Cliente (P)

- `next/dynamic` para o editor Tiptap, os gráficos e a paleta de comandos (carregar só quando abrir).
- Analisar o bundle (`@next/bundle-analyzer`). Conferir que `lucide-react` só traz os ícones usados.
- Prefetch dos links de tarefa no hover (Partial Prefetching já está ligado em `next.config.ts`).

---

## Fase 8 — Inteligência artificial (opcional: custo por uso, centavos)

A API do Claude não tem plano gratuito, mas o custo de um portfólio fica em centavos por mês. Os campos `aiSummary` e `subtasks[].generatedByAi` já existem no model `Task` e não têm uso.

### 8.1 Resumo da tarefa (P)

- Botão "Resumir com IA" no painel da tarefa: o Claude lê a descrição e os comentários e grava `aiSummary`.
- Modelo **Claude Haiku 5.5** (`claude-haiku-5-5`), barato e rápido para resumo. Resposta em streaming.

### 8.2 Sugerir subtarefas (P)

- Gera de 3 a 7 subtarefas a partir do título e da descrição. A pessoa escolhe quais entram, marcadas como `generatedByAi` (o badge "IA" já existe em `task-detail.tsx`).

### 8.3 Criar tarefas a partir de texto (M)

- Colar uma ata de reunião ou um texto livre → o Claude devolve tarefas estruturadas (tool use com schema zod: título, tipo, prioridade, responsável sugerido) → revisão antes de criar.

### 8.4 Assistente do documento (M)

- No editor (4.8): "continuar escrevendo", "resumir", "transformar em tarefas".

### 8.5 Controles (P, obrigatório se fizer a Fase 8)

- Limite de uso por workspace e por dia (Upstash, 1.4). Chave da API só no servidor. Registrar uso de tokens.
- Não enviar à API mais do que a tarefa ou o documento em questão.

### 8.6 API pública e integrações (G, futuro)

- `/api/v1` documentada (ver 2.3), tokens por workspace e **webhooks** de saída (`task.created`, `task.updated`).
- Integração com GitHub: mencionar `PF-12` num PR move a tarefa para "Em revisão" (GitHub App, gratuito).

---

## Fase 9 — Presença pública e acabamento de produto

### 9.1 Página inicial pública (M)

- Hoje `/` redireciona para o login (`app/page.tsx`). Trocar por uma landing page para quem não está logado:
  - hero com print do quadro;
  - recursos;
  - "Como funciona";
  - chamada para criar conta.
- Logado, `/` vai para "Minhas tarefas" (4.5).

### 9.2 SEO e compartilhamento (P)

- `metadata` por página (já iniciado em `app/layout.tsx`), `opengraph-image.tsx` gerado dinamicamente, `sitemap.ts`, `robots.ts` e favicon próprio (hoje é o do Next).

### 9.3 Modo demonstração (M) — importante para portfólio

- Botão "Ver demonstração" na landing: entra numa conta somente-leitura com um workspace de exemplo (dados do seed 0.5), sem cadastro.
- O banco de demonstração é recriado todo dia por cron.

### 9.4 Páginas institucionais (P)

- Termos de uso, Política de privacidade (LGPD: quais dados, para quê, como excluir — liga com 1.5), Sobre, e uma Central de ajuda simples (documentos estáticos em MDX).

### 9.5 Página de status e changelog (P)

- Changelog público (`/changelog`, MDX), gerado a partir dos commits convencionais.
- Status com **Better Stack** ou **UptimeRobot** (gratuitos), monitorando `/api/health`. Criar essa rota: checa o Mongo e responde 200.

---

## Ordem recomendada e marcos

| Marco                            | Fases / etapas               | Resultado visível                                                                       |
| -------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| **M1 — Base sólida**             | 0.1–0.6, 1.2, 1.8, 2.1       | Ambientes separados, CI verde, testes das regras principais, README de produto          |
| **M2 — Seguro**                  | 1.1, 1.3, 1.4, 1.5, 1.7      | Recuperação de senha, verificação de e-mail, limite de tentativas, página "Minha conta" |
| **M3 — Domínio maduro**          | 3.1, 3.2, 3.4, 3.6, 3.7      | Status configuráveis, ordem nas colunas, convites por e-mail, edição sem sobrescrita    |
| **M4 — Experiência de produto**  | 4.1–4.5, 6.1, 6.2, 6.5, 6.6  | Arrastar e soltar, filtros, Ctrl K, atalhos, "Minhas tarefas", modo escuro              |
| **M5 — Colaboração**             | 5.1–5.3, 3.5                 | Notificações, menções, tempo real, anexos                                               |
| **M6 — Profundidade**            | 4.6–4.10, 3.3, 6.3, 6.7, 6.8 | Lista, calendário, roadmap, relatórios, editor rico, lixeira, mobile e PWA              |
| **M7 — Vitrine**                 | 9.1–9.5, 7.x, 2.4–2.6        | Landing page, demonstração pública, SEO, métricas de performance, observabilidade       |
| **M8 — Diferenciais (opcional)** | 8.x, 1.6, 6.9, 8.6           | IA, 2FA, inglês, API pública e integração com GitHub                                    |

## Arquivos e pontos centrais

- **Código atual:**
  - `server/actions/*.actions.ts` (wrapper 2.1);
  - `server/services/*` e `lib/session.ts` (DAL 2.2);
  - `server/db/models.ts` e `server/db/types.ts` (Fase 3);
  - `server/schemas.ts` (reaproveitar no cliente, 6.1);
  - `lib/auth.ts` (1.1, 1.2) e `lib/db.ts` (0.1);
  - `app/w/[workspaceSlug]/projects/[projectKey]/page.tsx` (quadro, 4.1, 4.2);
  - `components/tasks/task-detail.tsx` (6.2, 8.x);
  - `components/docs/document-editor.tsx` (4.8, 3.7);
  - `app/globals.css` (6.5).
- **Reaproveitar:**
  - `verifyWorkspacePermission` (`server/services/permission.service.ts`) dentro da matriz 1.7;
  - `recordHistory` / `describeHistory` (`server/services/history.service.ts`, `lib/history-format.ts`) como base das notificações 5.1;
  - `loadTask` (`server/actions/task.actions.ts`) como modelo do wrapper 2.1;
  - os componentes `Empty`, `Field`, `Item`, `Sheet` e `Command` do shadcn já instalados ou disponíveis.

## Como verificar cada marco

- **Automático (a partir do M1):** em todo PR, o GitHub Actions roda `tsc`, `eslint`, Vitest (com Mongo em memória) e Playwright contra o deploy de preview, incluindo axe. Nenhum merge na `main` com check vermelho.
- **Manual, ao fim de cada marco:** percorrer o roteiro E2E (cadastro → workspace → projeto → tarefas → sprint → documento → membro) no preview, com o banco `-preview` populado pelo seed. Depois, conferir em produção:
  - Sentry sem erros novos;
  - Speed Insights dentro das metas (7.1);
  - nota A em securityheaders.com (a partir do M2).
- **Segurança (M2):** testar força bruta no login (deve bloquear na 6ª tentativa), um link de recuperação de senha usado duas vezes (deve falhar na segunda) e um GitHub com e-mail não verificado (não pode entrar na conta existente).

## Andamento

- **M1 — concluído** (falta ligar a Vercel ao GitHub e os testes E2E).
- **M2 — concluído**, com dois ajustes ao plano:
  - limite de tentativas no próprio MongoDB em vez do Upstash ([ADR 008](adrs/008-limite-de-tentativas-no-mongodb.md));
  - migração para o Auth.js v5 (1.1) adiada, e o papel Convidado (1.7) fica para quando houver convites (3.6).
- **M3 — concluído**, com dois itens movidos para os marcos em que são usados:
  - status como entidade ([ADR 009](adrs/009-status-como-entidade.md)), convites por e-mail,
    transferência de posse e proteção contra sobrescrita em documentos;
  - ordem das tarefas na coluna (3.2) vai junto com o arrastar e soltar (M4);
  - comentários em coleção própria (3.4) vão junto com menções e notificações (M5).
- **M4 — concluído**: arrastar e soltar com ordem por coluna (3.2 entrou aqui), filtros na URL,
  busca global com Ctrl K, "Minhas tarefas", tema escuro e páginas de erro e 404. Ajustes:
  - pelo teclado, mover é feito no menu "Mover para…" (colunas, topo e fim): o sensor de teclado
    do dnd-kit rola a página em vez de mover quando há rolagem;
  - filtros sem a biblioteca `nuqs` (URLSearchParams direto) e sem visões salvas;
  - formulários com react-hook-form (6.1) e atualização otimista fora do quadro (6.2) ficam para o M6.
- **M5 — parcial**: comentários em coleção própria e editáveis (3.4), menções com @Nome,
  notificações no app (sino e caixa de entrada) e por e-mail com preferência na conta.
  - Tempo real (5.3) depende de uma conta no Pusher ou Ably; até lá, quadro e tarefa buscam os dados
    de novo quando a pessoa volta para a aba.
  - Anexos (3.5) dependem de um Blob store na Vercel; etiquetas (3.5) e aviso de prazo por cron
    (2.6) ficam para a próxima rodada.
- **M6 — parcial**: lista e calendário (4.6), relatórios (4.7), Markdown renderizado nos documentos
  (parte de 4.8), primeiros passos (4.10) e PWA (6.7). Corrigido também um erro de hidratação da
  barra lateral no celular. Ficam para depois:
  - roadmap de épicos (4.6 + 3.3), templates (4.9), lixeira (6.3) e editor rico Tiptap (4.8);
  - burndown, que precisa de snapshots diários por cron (2.6);
  - os gráficos são HTML e CSS, sem biblioteca: uma série por gráfico, cor validada nos dois temas.
- **M7 — parcial**: página inicial pública, modo demonstração só leitura (botão "Ver demonstração"),
  SEO (metadados, imagem de compartilhamento, sitemap, robots), termos e privacidade, `/api/health`,
  Vercel Web Analytics e Speed Insights. Ficam para depois:
  - Sentry e envio de logs (precisam de conta), cache com tags (2.4) e jobs agendados (2.6);
  - changelog público e página de status (o monitor pode usar `/api/health`).
- **M8 — parcial**: verificação em duas etapas (1.6), IA na tarefa com resumo e sugestão de
  subtarefas (8.1, 8.2, 8.5) e API pública v1 só leitura com tokens e OpenAPI (parte de 8.6).
  Ficam para depois: texto livre virando tarefas (8.3), assistente do documento (8.4), escrita e
  webhooks na API, integração com GitHub e inglês (6.9).

## Balanço depois dos 8 marcos (25/11/2026)

Tudo que o plano previa e ainda não existe, agrupado pelo que destrava cada item.

### Precisa de uma ação sua (conta, chave ou configuração)

| Item                         | O que falta                                                                                     | Etapa         |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | ------------- |
| E-mails de verdade           | `RESEND_API_KEY` na Vercel; para enviar a qualquer pessoa, um domínio verificado e `EMAIL_FROM` | 1.3, 3.6, 5.2 |
| IA na tarefa                 | `ANTHROPIC_API_KEY` na Vercel (o código já está em produção, escondido)                         | 8.1, 8.2      |
| Deploy de preview por PR     | ligar a Vercel ao GitHub e proteger a `main` (exigir PR e CI verde)                             | 0.2, 0.4      |
| Métricas de uso e desempenho | ligar Web Analytics e Speed Insights no painel da Vercel                                        | 7.1           |
| Tempo real                   | conta gratuita no Pusher ou Ably                                                                | 5.3           |
| Anexos e fotos               | Blob store na Vercel (cria uma chave de acesso)                                                 | 3.5, 6.4      |
| Erros e logs                 | conta no Sentry e um log drain (Axiom ou Better Stack)                                          | 2.5           |
| Jobs agendados               | `CRON_SECRET` na Vercel para proteger as rotas de cron                                          | 2.6           |
| Segredos OAuth               | confirmar que os do Google e do GitHub foram trocados                                           | 1.8           |

### Dá para fazer só com código

**Segurança e contas**

- ~~Encerrar as outras sessões ao trocar a senha ou ligar a verificação em duas etapas~~ **feito**:
  versão de sessão no usuário, conferida a cada leitura do JWT; botão "Sair de todos os dispositivos".
- Exigir e-mail confirmado para ações sensíveis (convidar, excluir workspace) (1.3).
- Exportar meus dados em JSON e lista de sessões em Minha conta (1.5).
- Papel Convidado, só leitura (1.7).
- CSP com nonce em vez de `'unsafe-inline'` e conferir a nota no securityheaders.com (1.4).
- Migração para o Auth.js v5, quando sair do beta (1.1).

**Domínio**

- Épicos e relações entre tarefas (bloqueia, duplica) (3.3).
- Etiquetas por workspace, com cor e filtro (3.5).
- Ao remover um membro, oferecer reatribuir as tarefas dele (3.6).
- Proteção contra sobrescrita também na descrição da tarefa (3.7).
- Paginação do histórico e revisão de índices (3.8); slug do workspace editável (3.9).

**Produto e interface**

- Atalhos de teclado além de Ctrl K e `/` (C, G B, J/K, `?`) (4.4).
- Visões salvas e agrupamento por responsável no quadro (4.2).
- Depois do login, ir para Minhas tarefas ou o último workspace (4.5).
- Roadmap de épicos (4.6), burndown e fluxo cumulativo (4.7, depende dos jobs agendados).
- Editor rico, versões e mover documentos na árvore (4.8); modelos de projeto (4.9).
- Lixeira com restauração por 30 dias e "Desfazer" no aviso (6.2, 6.3).
- Formulários com react-hook-form e atualização otimista fora do quadro (6.1, 6.2).
- Quadro no celular em abas por coluna e tabelas virando cartões (6.7).
- Auditoria de acessibilidade com axe em todas as telas (6.8); inglês (6.9).
- Cores e ícones por projeto e transições entre visões (6.10).

**Plataforma**

- Leituras com cache por tags em vez de `revalidatePath` (2.4) e camada única de acesso a dados (2.2).
- Menos consultas em sequência ao abrir um projeto e carregamento sob demanda de partes pesadas (7.2, 7.3).
- Escrita e webhooks na API pública, integração com o GitHub (8.6); texto livre virando tarefas e
  assistente do documento (8.3, 8.4).
- Changelog público e página de status (9.5).

### Ordem sugerida

1. ~~Testes ponta a ponta (Playwright)~~ **feito**: roteiro completo e axe em `e2e/`, rodando na CI.
   Falta ligar a Vercel ao GitHub para ter preview por PR.
2. ~~Encerrar sessões ao trocar a senha~~ **feito**: troca e redefinição de senha, ligar o 2FA e
   "Sair de todos os dispositivos" encerram todas as sessões abertas.
3. **Resend e Anthropic.** Duas chaves que acendem recursos já prontos (convites, recuperação de senha,
   notificações por e-mail e IA).
4. **Etiquetas, lixeira e atalhos.** São os itens de produto mais visíveis para quem usa todo dia.
