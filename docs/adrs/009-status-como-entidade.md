# Status das tarefas como entidade do projeto

## Data

> 25/11/2026

## Status

> Aceita

## Contexto

Os status eram uma lista de textos no projeto (`["A Fazer", …, "Concluído"]`) e a tarefa guardava o
nome do status. Isso trazia três problemas:

- renomear um status deixaria as tarefas apontando para um nome que não existe mais;
- "concluído" era deduzido como o último item da lista, então reordenar mudava o significado;
- não havia como ter dois status de conclusão (ex.: "Concluído" e "Cancelado").

## Decisão

- `Project.statuses` é um array de subdocumentos `{ _id, name, category }`, na ordem das colunas.
  `category` é `TODO`, `IN_PROGRESS` ou `DONE`.
- `Task.statusId` guarda o `_id` do status. Nome e posição podem mudar sem tocar nas tarefas.
- Regras de negócio usam a categoria: concluir uma sprint devolve as tarefas fora de `DONE`;
  a tarefa nova vai para o primeiro status `TODO`.
- Remover um status move as tarefas para o primeiro status restante da mesma categoria (ou o
  primeiro da lista), na mesma transação que salva as colunas.
- O histórico grava os **nomes** antigo e novo, para continuar legível depois de um renomear.
- Os status ficam embutidos no projeto (não numa coleção própria): são poucos, sempre lidos junto
  com o projeto e nunca consultados sozinhos.

A migração dos dados antigos está em `scripts/migrate-statuses.ts` (idempotente, com `--dry-run`).

## Consequências

- Positivas
  - Colunas configuráveis pelo admin sem quebrar tarefas nem relatórios futuros.
  - Base para o arrastar e soltar (M4) e para métricas por categoria (burndown, tempo de ciclo).
- Negativas
  - Toda tela que mostra o status precisa do projeto para traduzir `statusId` em nome.
  - Exige rodar a migração antes de publicar a versão nova em bancos com dados antigos.
