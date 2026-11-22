# 003 Uso de Schemas mongoose para a definição de entidades e contratos MongoDB

## Data
> 22/11/2026

## Status
> Aceito

## Contexto
Necessidade da definição das entidades definidas no arquivo `modelo-er.mmd` para mapeamento no banco.

## Decisão
Uso dos **Schemas** do mongoose para a definição dos **Models** que serão usados para o acesso dessas entidades no banco.

## Consequências
- Positivas
    - Mapeamento via código typescript.
    - Uso do ORM e acesso direto das entidades, permitindo operações **CRUD** em códigos typescript em qualquer lugar da aplicação.
- Negativas
    - **Tecnology Lock-In**: Alto acomplamento na questão de persistência devido ao uso de características nativas do mongoose/MongoDB, dificultando a migração para outro banco de dados, como PostgreSQL.