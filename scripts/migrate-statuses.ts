/**
 * Migração: status como texto → status como entidade (M3).
 *
 *   npx tsx --env-file=.env.local scripts/migrate-statuses.ts [--dry-run]
 *
 * Projeto: statuses ["A Fazer", …] vira [{ _id, name, category }], com o primeiro como "A fazer",
 * o último como "Concluído" e o resto "Em andamento" (a regra que o app usava antes).
 * Tarefa: status (nome) vira statusId; nomes que não existem no projeto vão para o primeiro status.
 * Pode rodar de novo: projetos já migrados são ignorados.
 */
import mongoose, { Types } from "mongoose";
import dbConnect, { DB_NAME } from "@/lib/db";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  await dbConnect();
  const db = mongoose.connection.db!;
  const projects = db.collection("projects");
  const tasks = db.collection("tasks");
  console.log(`Banco: ${DB_NAME}${dryRun ? " (simulação, nada é gravado)" : ""}`);

  const pending = await projects.find({ "statuses.0": { $type: "string" } }).toArray();
  console.log(`Projetos para migrar: ${pending.length}`);

  for (const project of pending) {
    const names = project.statuses as string[];
    const statuses = names.map((name, i) => ({
      _id: new Types.ObjectId(),
      name,
      category: i === names.length - 1 ? "DONE" : i === 0 ? "TODO" : "IN_PROGRESS",
    }));

    let migrated = 0;
    for (const status of statuses) {
      const filter = { projectId: project._id, statusId: { $exists: false }, status: status.name };
      migrated += dryRun
        ? await tasks.countDocuments(filter)
        : (await tasks.updateMany(filter, { $set: { statusId: status._id }, $unset: { status: "" } }))
            .modifiedCount;
    }
    const orphanFilter = { projectId: project._id, statusId: { $exists: false }, status: { $nin: names } };
    const orphans = dryRun
      ? await tasks.countDocuments(orphanFilter)
      : (
          await tasks.updateMany(orphanFilter, {
            $set: { statusId: statuses[0]!._id },
            $unset: { status: "" },
          })
        ).modifiedCount;

    if (!dryRun) await projects.updateOne({ _id: project._id }, { $set: { statuses } });
    console.log(
      `  ${project.key}: ${names.join(" → ")} · ${migrated} tarefas migradas, ${orphans} sem status conhecido`
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
