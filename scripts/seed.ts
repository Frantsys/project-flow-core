/**
 * Popula o banco de desenvolvimento ou de preview com um workspace de demonstração realista.
 *
 *   npm run seed            (usa .env.local: MONGODB_URI, MONGODB_DB e SEED_PASSWORD)
 *
 * Recusa rodar no banco de produção. Apaga e recria só os dados do workspace "acme-labs-demo"
 * e das contas @demo.projectflow.dev; o resto do banco fica intocado.
 */
import bcrypt from "bcryptjs";
import mongoose, { Types } from "mongoose";
import dbConnect, { DB_NAME } from "@/lib/db";
import { ChangeHistory, DocumentModel, Project, Sprint, Task, User, Workspace } from "@/server/db/models";

const PRODUCTION_DB = "project-flow";
const SLUG = "acme-labs-demo";
const DOMAIN = "demo.projectflow.dev";
const DAY = 86_400_000;

if (!process.env.MONGODB_DB || DB_NAME === PRODUCTION_DB) {
  console.error(
    `Seed recusado: defina MONGODB_DB com um banco que não seja "${PRODUCTION_DB}" (ex.: project-flow-dev).`
  );
  process.exit(1);
}
if (!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.length < 8) {
  console.error("Defina SEED_PASSWORD (mínimo de 8 caracteres) para a conta demo@" + DOMAIN + ".");
  process.exit(1);
}

const people = [
  { key: "demo", username: "Conta Demo" },
  { key: "marina", username: "Marina Souza" },
  { key: "joao", username: "João Pereira" },
  { key: "lia", username: "Lia Ramos" },
  { key: "rafael", username: "Rafael Lima" },
] as const;

type TaskSeed = [
  title: string,
  type: "TASK" | "BUG" | "STORY",
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  points: number | null,
];

const backlog: Record<string, TaskSeed[]> = {
  PF: [
    ["Filtro de tarefas por sprint", "STORY", "HIGH", 5],
    ["Erro ao salvar projeto sem descrição", "BUG", "URGENT", 2],
    ["Login com GitHub", "TASK", "MEDIUM", 3],
    ["Convite de membros por e-mail", "STORY", "HIGH", 5],
    ["Arrastar e soltar no quadro", "STORY", "HIGH", 8],
    ["Estado vazio do quadro", "TASK", "LOW", 1],
    ["Página de configurações do workspace", "TASK", "MEDIUM", 3],
    ["Histórico de alterações por tarefa", "STORY", "MEDIUM", 5],
    ["Contraste do modo escuro", "BUG", "MEDIUM", 2],
    ["Atalhos de teclado", "TASK", "LOW", 3],
    ["Busca global com Ctrl K", "STORY", "HIGH", 5],
    ["Notificações de menção", "STORY", "MEDIUM", 8],
    ["Tempo de carregamento do quadro", "BUG", "HIGH", 3],
    ["Exportar tarefas em CSV", "TASK", "LOW", 2],
    ["Relatório de velocidade", "STORY", "MEDIUM", 5],
    ["Duplicar tarefa", "TASK", "LOW", 1],
  ],
  WEB: [
    ["Nova página inicial", "STORY", "HIGH", 8],
    ["Formulário de contato não envia", "BUG", "URGENT", 2],
    ["Otimizar imagens do hero", "TASK", "MEDIUM", 2],
    ["Página de preços", "STORY", "MEDIUM", 5],
    ["Ajustar SEO das páginas de blog", "TASK", "LOW", 3],
    ["Link quebrado no rodapé", "BUG", "LOW", 1],
    ["Integração com analytics", "TASK", "MEDIUM", 3],
    ["Política de privacidade", "TASK", "HIGH", 2],
    ["Versão em inglês", "STORY", "LOW", 8],
    ["Banner de cookies", "TASK", "MEDIUM", 2],
    ["Depoimentos de clientes", "STORY", "LOW", 3],
    ["Teste A/B do botão de cadastro", "TASK", "MEDIUM", 3],
  ],
  APP: [
    ["Tela de login no app", "STORY", "HIGH", 5],
    ["Notificações push", "STORY", "MEDIUM", 8],
    ["App fecha ao girar a tela", "BUG", "URGENT", 3],
    ["Modo offline do quadro", "STORY", "HIGH", 13],
    ["Ícone e splash screen", "TASK", "LOW", 1],
    ["Publicar na loja de apps", "TASK", "MEDIUM", 3],
    ["Biometria no login", "STORY", "MEDIUM", 5],
    ["Lista de tarefas com rolagem lenta", "BUG", "HIGH", 3],
    ["Compartilhar tarefa por link", "TASK", "LOW", 2],
    ["Tema escuro no app", "TASK", "MEDIUM", 3],
    ["Onboarding em 3 telas", "STORY", "MEDIUM", 5],
    ["Configurar crash reporting", "TASK", "HIGH", 2],
  ],
};

const projects = [
  {
    key: "PF",
    name: "Project Flow",
    description: "Gestor de projetos com quadro kanban, sprints e documentos.",
  },
  { key: "WEB", name: "Site institucional", description: "Novo site da Acme em Next.js." },
  { key: "APP", name: "App mobile", description: "Aplicativo do cliente final para iOS e Android." },
];

async function main() {
  await dbConnect();
  console.log(`Banco: ${DB_NAME}`);

  // limpa só o que este seed criou antes
  const oldWs = await Workspace.findOne({ slug: SLUG }).select("_id").lean<{ _id: Types.ObjectId }>();
  if (oldWs) {
    const oldProjects = (await Project.find({ workspaceId: oldWs._id }).select("_id").lean()).map(
      (p) => p._id
    );
    await Task.deleteMany({ projectId: { $in: oldProjects } });
    await Sprint.deleteMany({ projectId: { $in: oldProjects } });
    await DocumentModel.deleteMany({ workspaceId: oldWs._id });
    await ChangeHistory.deleteMany({ workspaceId: oldWs._id });
    await Project.deleteMany({ workspaceId: oldWs._id });
    await Workspace.deleteOne({ _id: oldWs._id });
  }
  await User.deleteMany({ email: { $regex: `@${DOMAIN.replace(/\./g, "\\.")}$` } });

  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD!, 12);
  const users = Object.fromEntries(
    await Promise.all(
      people.map(async (p) => {
        const user = await User.create({
          username: p.username,
          email: `${p.key}@${DOMAIN}`,
          // só a conta demo entra com senha; as outras existem para aparecer como membros
          ...(p.key === "demo" ? { passwordHash } : {}),
          emailVerified: new Date(),
        });
        return [p.key, user._id] as const;
      })
    )
  ) as Record<(typeof people)[number]["key"], Types.ObjectId>;
  const team = [users.demo, users.marina, users.joao, users.lia, users.rafael];

  const now = Date.now();
  const ws = await Workspace.create({
    name: "Acme Labs",
    slug: SLUG,
    ownerId: users.demo,
    members: [
      { userId: users.demo, role: "OWNER", joinedAt: new Date(now - 90 * DAY) },
      { userId: users.marina, role: "ADMIN", joinedAt: new Date(now - 80 * DAY) },
      { userId: users.joao, role: "MEMBER", joinedAt: new Date(now - 60 * DAY) },
      { userId: users.lia, role: "MEMBER", joinedAt: new Date(now - 45 * DAY) },
      { userId: users.rafael, role: "MEMBER", joinedAt: new Date(now - 20 * DAY) },
    ],
  });

  let taskCount = 0;
  for (const [pi, p] of projects.entries()) {
    const project = await Project.create({ workspaceId: ws._id, ...p, taskSequence: 0 });
    const statuses = project.statuses.map((st) => st._id);

    const sprints = await Sprint.insertMany([
      {
        projectId: project._id,
        name: "Sprint 1",
        goal: "Fundação do projeto",
        status: "COMPLETED",
        startDate: new Date(now - 28 * DAY),
        endDate: new Date(now - 14 * DAY),
      },
      {
        projectId: project._id,
        name: "Sprint 2",
        goal: "Primeira versão para o time testar",
        status: "ACTIVE",
        startDate: new Date(now - 7 * DAY),
        endDate: new Date(now + 7 * DAY),
      },
      {
        projectId: project._id,
        name: "Sprint 3",
        goal: "Polimento e feedback",
        status: "PLANNED",
        startDate: new Date(now + 7 * DAY),
        endDate: new Date(now + 21 * DAY),
      },
    ]);
    const [done, active, planned] = sprints;

    const seeds = backlog[p.key] ?? [];
    const tasks = seeds.map(([title, type, priority, storyPoints], i) => {
      // distribuição: concluídas na sprint 1, espalhadas na ativa, planejadas e backlog
      const sprint = i < 4 ? done : i < 10 ? active : i < 13 ? planned : null;
      const statusId =
        sprint === done
          ? statuses.at(-1)!
          : sprint === active
            ? statuses[i % statuses.length]!
            : statuses[0]!;
      const assignee = i % 5 === 4 ? null : team[(i + pi) % team.length];
      const due = sprint === active ? new Date(now + ((i % 5) - 1) * DAY) : null;
      return {
        projectId: project._id,
        sprintId: sprint?._id ?? null,
        reporterId: team[(i + 1) % team.length],
        assigneeId: assignee,
        code: `${p.key}-${i + 1}`,
        title,
        type,
        priority,
        storyPoints,
        statusId,
        dueDate: due,
        description:
          i % 3 === 0
            ? `Contexto: ${title.toLowerCase()}.\n\nCritérios de aceite:\n- funciona no celular\n- tem teste`
            : "",
        subtasks:
          i % 4 === 0
            ? ["Levantar requisitos", "Implementar", "Revisar com o time"].map((s, order) => ({
                title: s,
                order,
                isCompleted: order < (sprint === done ? 3 : 1),
                generatedByAi: false,
              }))
            : [],
        comments:
          i % 3 === 1
            ? [
                {
                  authorId: team[(i + 2) % team.length],
                  content: "Posso pegar essa depois da daily.",
                  createdAt: new Date(now - DAY),
                },
              ]
            : [],
        createdAt: new Date(now - (30 - i) * DAY),
      };
    });
    await Task.insertMany(tasks);
    await Project.updateOne({ _id: project._id }, { $set: { taskSequence: tasks.length } });
    taskCount += tasks.length;

    await ChangeHistory.insertMany(
      tasks.slice(0, 5).map((t, i) => ({
        workspaceId: ws._id,
        projectId: project._id,
        userId: team[i % team.length],
        actorRole: i === 0 ? "OWNER" : i === 1 ? "ADMIN" : "MEMBER",
        action: "CREATE",
        targetType: "TASK",
        targetId: new Types.ObjectId(),
        details: { targetTitle: `${t.code} ${t.title}` },
        createdAt: new Date(now - (i + 1) * 3_600_000),
      }))
    );
  }

  const guide = await DocumentModel.create({
    workspaceId: ws._id,
    authorId: users.demo,
    title: "Guia de onboarding",
    content:
      '# Bem-vindo à Acme Labs\n\n- Leia os processos do time\n- Peça acesso aos projetos\n- Escolha uma tarefa marcada como "bom primeiro passo"',
  });
  await DocumentModel.create({
    workspaceId: ws._id,
    parentDocId: guide._id,
    authorId: users.marina,
    title: "Processos do time",
    content:
      "## Rituais\n\n- Daily às 9h30\n- Planejamento a cada duas semanas\n- Retrospectiva no fim da sprint",
  });

  console.log(`Pronto: workspace /w/${SLUG}, ${projects.length} projetos, ${taskCount} tarefas.`);
  console.log(`Entre com demo@${DOMAIN} e a senha definida em SEED_PASSWORD.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
