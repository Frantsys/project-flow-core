# Uso da biblibioteca next-auth para autenticação geral da aplicação

## Data

> 22/11/2026

## Status

> Aceito

## Contexto

Necessidade de gerenciar e centralizar a lógica de autenticação da aplicação.

## Decisão

Uso da biblioteca `next-auth`, com o adapter `@auth/mongodb-adapter` para centralizar e configurar a autenticação da aplicação.

## Consequências

- Positivas
  - Autenticação sem a necessidade de configurações boilerplate
- Negativas
  - Limitado a auth provider local, no momento que frontend e backend forem desacoplados, parte da lógica terá de ser refeita.
