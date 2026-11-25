/**
 * Migração (M5): comentários embutidos na tarefa → coleção `comments`.
 *
 *   npm run migrate:comments            (ou: -- --dry-run)
 *
 * Copia cada comentário com o mesmo _id e a mesma data, e só depois tira o array da tarefa.
 * Pode rodar de novo: tarefas sem o array são ignoradas e _id repetido não é duplicado.
 */
import mongoose, { Types } from "mongoose";
import dbConnect, { DB_NAME } from "@/lib/db";

const dryRun = process.argv.includes("--dry-run");

interface LegacyTask {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  code: string;
  comments: { _id: Types.ObjectId; authorId: Types.ObjectId; content: string; createdAt?: Date }[];
}

async function main() {
  await dbConnect();
  const db = mongoose.connection.db!;
  console.log(`Banco: ${DB_NAME}${dryRun ? " (simulação, nada é gravado)" : ""}`);

  const tasks = await db
    .collection<LegacyTask>("tasks")
    .find({ comments: { $exists: true } })
    .project<LegacyTask>({ projectId: 1, code: 1, comments: 1 })
    .toArray();
  const projects = new Map(
    (
      await db
        .collection("projects")
        .find({}, { projection: { workspaceId: 1 } })
        .toArray()
    ).map((p) => [p._id.toString(), p.workspaceId as Types.ObjectId])
  );

  let copied = 0;
  for (const task of tasks) {
    const workspaceId = projects.get(task.projectId.toString());
    if (!workspaceId) continue; // tarefa órfã: fica como está
    if (!dryRun && task.comments.length > 0) {
      await db.collection("comments").bulkWrite(
        task.comments.map((c) => ({
          updateOne: {
            filter: { _id: c._id },
            update: {
              $setOnInsert: {
                taskId: task._id,
                projectId: task.projectId,
                workspaceId,
                authorId: c.authorId,
                content: c.content,
                mentions: [],
                editedAt: null,
                createdAt: c.createdAt ?? new Date(),
              },
            },
            upsert: true,
          },
        }))
      );
    }
    if (!dryRun) await db.collection("tasks").updateOne({ _id: task._id }, { $unset: { comments: "" } });
    copied += task.comments.length;
  }
  console.log(`Tarefas com o array antigo: ${tasks.length} · comentários copiados: ${copied}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
