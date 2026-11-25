import { NextResponse } from "next/server";

/** Especificação OpenAPI 3.1 da API v1 (abre em Swagger Editor, Scalar, Postman, Insomnia). */
const task = {
  type: "object",
  properties: {
    code: { type: "string", example: "PF-12" },
    title: { type: "string" },
    type: { type: "string", enum: ["TASK", "BUG", "STORY"] },
    status: { type: ["string", "null"], example: "Em Andamento" },
    statusCategory: { type: ["string", "null"], enum: ["TODO", "IN_PROGRESS", "DONE", null] },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
    storyPoints: { type: ["integer", "null"] },
    dueDate: { type: ["string", "null"], format: "date" },
    assignee: { type: ["object", "null"], properties: { name: { type: "string" } } },
    sprint: { type: ["object", "null"], properties: { name: { type: "string" } } },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

const errors = {
  "401": { description: "Token ausente, inválido ou revogado" },
  "429": { description: "Mais de 120 chamadas por minuto (veja Retry-After)" },
};

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Project Flow API",
    version: "1.0.0",
    description:
      "Leitura de projetos e tarefas de um workspace. Crie um token em Configurações › API (dono ou admin) e envie em `Authorization: Bearer pf_...`.",
  },
  servers: [{ url: "/api/v1" }],
  security: [{ bearer: [] }],
  components: {
    securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
    schemas: { Task: task },
  },
  paths: {
    "/projects": {
      get: {
        summary: "Projetos do workspace",
        responses: { "200": { description: "Lista de projetos com seus status" }, ...errors },
      },
    },
    "/projects/{key}/tasks": {
      get: {
        summary: "Tarefas de um projeto",
        parameters: [
          { name: "key", in: "path", required: true, schema: { type: "string" }, example: "PF" },
          { name: "status", in: "query", schema: { type: "string" }, description: "Nome do status" },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
        ],
        responses: {
          "200": {
            description: "Página de tarefas",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Task" } },
                    pagination: {
                      type: "object",
                      properties: {
                        total: { type: "integer" },
                        limit: { type: "integer" },
                        offset: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "404": { description: "Projeto não encontrado neste workspace" },
          ...errors,
        },
      },
    },
    "/projects/{key}/tasks/{code}": {
      get: {
        summary: "Uma tarefa, com descrição e subtarefas",
        parameters: [
          { name: "key", in: "path", required: true, schema: { type: "string" } },
          { name: "code", in: "path", required: true, schema: { type: "string" }, example: "PF-12" },
        ],
        responses: {
          "200": { description: "Tarefa" },
          "404": { description: "Tarefa não encontrada" },
          ...errors,
        },
      },
    },
  },
};

export function GET() {
  return NextResponse.json(spec);
}
