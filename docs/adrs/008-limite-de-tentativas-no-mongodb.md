# Limite de tentativas e links de e-mail no próprio MongoDB

## Data

> 25/11/2026

## Status

> Aceita

## Contexto

O login, o cadastro e a recuperação de senha precisavam de limite de tentativas contra força bruta
e abuso. Na Vercel cada requisição pode cair numa instância diferente, então um contador em memória
não serve. O plano original previa o Upstash Redis.

Também era preciso guardar os links de uso único (redefinir senha, confirmar e-mail).

Opções consideradas:

- Upstash Redis + `@upstash/ratelimit`: rápido, mas é mais um serviço, uma conta e duas variáveis.
- **Coleções no MongoDB já usado pelo app**, com índice TTL para apagar o que venceu.

## Decisão

- `RateLimit`: janela fixa por chave (`login:<ip>:<email>`, `signup:<ip>`, `forgot:email:<email>`…),
  incrementada com um `findOneAndUpdate` atômico com upsert (`server/lib/rate-limit.ts`).
- `AuthToken`: guarda só o hash SHA-256 do token; é consumido com `findOneAndDelete`, o que garante
  uso único mesmo com dois cliques simultâneos (`server/lib/auth-tokens.ts`).
- E-mails pela API HTTP da Resend (`lib/email.ts`), sem SDK. Sem `RESEND_API_KEY` em
  desenvolvimento, o e-mail aparece no terminal.

A migração para o Auth.js v5 (item 1.1 do roadmap) ficou adiada: a v5 segue em beta e não traz
ganho visível para quem usa o app.

## Consequências

- Positivas
  - Nenhum serviço novo; os testes cobrem o limite e os tokens com o MongoDB em memória.
  - Links de e-mail vazados do banco não servem para nada (só o hash fica guardado).
- Negativas
  - Cada tentativa limitada custa uma escrita no MongoDB (aceitável no volume atual).
  - Janela fixa permite até o dobro do limite na virada da janela; para login isso é suficiente.
  - O índice TTL do MongoDB roda a cada ~60 s, então documentos vencidos somem com atraso
    (a consulta já ignora os vencidos).
