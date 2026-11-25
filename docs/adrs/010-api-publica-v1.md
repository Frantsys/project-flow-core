# API pública v1 com tokens por workspace

## Data

> 25/11/2026

## Status

> Aceita

## Contexto

Times querem levar as tarefas para planilhas, painéis e scripts. As rotas `/api/workspaces/**` da
primeira versão liam a sessão do navegador, repetiam os services e não eram usadas por nenhuma tela.

## Decisão

- API em `/api/v1`, só leitura: projetos, tarefas de um projeto (paginadas, filtro por status) e uma
  tarefa com descrição e subtarefas. Especificação OpenAPI 3.1 em `/api/v1/openapi.json`.
- Autenticação por token de workspace (`Authorization: Bearer pf_...`), criado por dono ou admin em
  Configurações › API. O banco guarda só o hash SHA-256 e um prefixo para reconhecer o token na lista;
  o valor aparece uma única vez. Até 10 tokens por workspace; revogar corta o acesso na hora.
- Limite de 120 chamadas por minuto por token, com `Retry-After` no 429.
- Formato próprio (`server/services/public-api.service.ts`), separado dos DTOs da interface: é contrato
  com integrações externas. Pessoas aparecem só pelo nome, sem e-mail.
- As rotas antigas `/api/workspaces/**` foram removidas (ADR 005 substituída).

## Consequências

- Positivas
  - Integrações sem compartilhar senha de ninguém, com escopo de um workspace só.
  - Contrato documentado e testado (`server/__tests__/public-api.test.ts`).
- Negativas
  - Escrita (criar e mover tarefas) e webhooks ficam para uma v1.1.
  - Token vazado dá leitura do workspace até ser revogado; não há expiração automática.
