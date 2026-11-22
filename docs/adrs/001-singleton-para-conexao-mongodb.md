# Uso de Singleton para conexão com banco de dados MongoDB

## Data
> 21/11/2026

## Status
> Aceito

## Contexto
Necessidade de acesso ao banco de dados MongoDB sem a necessidade de reabertura de uma nova conexão a cada uso.

## Decisão
Uso do padrão **Singleton**, através de uma constante reutilizável e cacheada de conexão no arquivo `db.ts`.

## Consequências
- Positivas
    - Prevenção de esgotamento de conexões, evitando que o NextJS estoure rapidamente o limite de conexões.
    - Centralização do ciclo de vida e registro de Schemas em um único ponto.
- Negativas
    - Uso de mesmas credenciais para todo o acesso.
    - Dificulta em testes unitários.