# Testes de integração com MongoDB em memória

## Data

> 25/11/2026

## Status

> Aceita

## Contexto

As regras mais importantes do sistema estão nas Server Actions e dependem do banco: permissões por
papel, código sequencial das tarefas, exclusões em cascata em transação, conclusão de sprint. Testar
com mocks do Mongoose não pegaria erros reais, como o ObjectId comparado com string que deixava todas
as páginas de workspace em "não encontrado", ou uma opção de transação com nome errado.

Opções consideradas:

- Mocks do Mongoose: rápidos, mas não testam consultas, índices nem transações.
- Um banco de teste no Atlas: real, mas lento, compartilhado e dependente de rede na CI.
- **mongodb-memory-server com replica set**: MongoDB real, local e descartável.

## Decisão

Vitest + `mongodb-memory-server` com um replica set de um nó (necessário para transações),
configurado em `vitest.config.mts` e `test/`.

- Um banco para toda a execução; os arquivos rodam em sequência e cada teste começa com as
  coleções vazias.
- A sessão é simulada com `actAs(userId)` (`test/session-state.ts`).
- As actions são chamadas diretamente, como o React chamaria.

## Consequências

- Positivas
  - Testa consultas, índices únicos e transações de verdade.
  - Roda na CI sem serviços externos (o binário do MongoDB fica em cache).
- Negativas
  - A primeira execução baixa o binário do MongoDB (cerca de 100 MB).
  - Mais lento que testes puramente unitários (poucos segundos para a suíte atual).
