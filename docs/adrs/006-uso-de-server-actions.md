# Uso de Server Actions para mutações

## Data

> 22/11/2026 · atualizada em 25/11/2026

## Status

> Aceita

## Contexto

Necessidade de mutações consistentes em formulários e controle de estado. Com as primeiras actions,
cada uma repetia o mesmo bloco: ler a sessão, validar com zod, checar permissão no workspace,
try/catch e montar o `ActionResult`. Eram cerca de 15 cópias, com pequenas diferenças de mensagem
e de tratamento de erro entre elas.

## Decisão

Todas as mutações são Server Actions criadas com `createAction` (`server/lib/action.ts`):

- `createAction({ name, schema, handler })` lê a sessão, valida a entrada com o schema zod, executa o
  handler e devolve sempre um `ActionResult` (`types.ts`).
- Regras de negócio interrompem o handler com `fail("mensagem", fieldErrors?)`, que vira
  `{ success: false }` para o cliente. Erros inesperados viram uma mensagem genérica e vão para o log
  com o nome da action.
- Permissões usam `requireWorkspaceRole(workspaceId, userId, papéis)` (`server/lib/access.ts`).
- A sessão é lida só em `getSessionUserId()`, o que permite trocá-la nos testes.

Leituras continuam em Server Components chamando os services (ver ADR 005).

## Consequências

- Positivas
  - Cada action descreve só a própria regra; o comportamento padrão é igual em todas.
  - Testável com Vitest sem servidor HTTP (ADR 007).
  - Mensagens de erro consistentes para a pessoa usuária.
- Negativas
  - Mais uma abstração própria para aprender.
  - Uma action que precise de um fluxo muito diferente (ex.: streaming) fica fora do wrapper.
