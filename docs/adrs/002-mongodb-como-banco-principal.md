# 002 MongoDB como Banco de Dados principal

## Data
> 21/11/2026

## Status
> Aceito

## Contexto
Definição de um Banco de dados principal da aplicação.

## Decisão
Uso do MongoDB, hospedado a partir da plataforma MongoDB Atlas.

## Consequências
- Positivas
    - Flexibilidade de Schema.
    - Escalabilidade horizontal nativa.
    - Ecosistema Atlas para deploy.
- Negativas
    - Ausência de integridade referencial: MongoDB não impede uma relação com um ObjectId de um documento inexistente e nem apaga entidades filhas automaticamente.
    - Acoplamento do sistema ao padrão **NoSQL** via **Document**, dificultando a mudança para um banco SQL.