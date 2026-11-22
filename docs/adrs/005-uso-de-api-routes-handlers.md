# API Route Handlers para endpoints REST


## Data
> 22/11/2026

## Status
> Aceita

## Contexto
Necessidade de interação entre frontend e backend da aplicação NextJS.

Duas opções estão sendo consideradas:

- Uso de Services que são chamados diretamente em páginas server components
- Uso de Services + API Route Handlers para consumo via fetch em client components


## Decisão
Abordagem Híbrida: Uso de Services separados em server components e pages, mas em client components as API Routes são consumidas.

## Consequências
- Positivas
    - Mutações e Queries dinâmicas e interativas em client components.
    - Testes isolados do backend via Postman.
    - Sem duplicação de código.
- Negativas
    - Possível boilerplate HTTP, uma vez que todo setup de checagem de permissão, parsing e try/catch deve ser feito para cada rota.
    - Dificuldade na tipagem ponta-a-ponta: no consumo via client components, não há nenhuma garantia de tipagem em tempo de execução.