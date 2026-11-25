/**
 * Migração (M4): dá posição (`rank`) às tarefas que ainda não têm, por ordem de criação em cada coluna.
 *
 *   npm run migrate:ranks
 *
 * Pode rodar de novo: só mexe em tarefas sem rank.
 */
import mongoose from "mongoose";
import dbConnect, { DB_NAME } from "@/lib/db";
import { Project } from "@/server/db/models";
import { backfillRanks } from "@/server/lib/rank";

async function main() {
  await dbConnect();
  console.log(`Banco: ${DB_NAME}`);
  const projects = await Project.find().select("key statuses").lean();
  for (const project of projects) {
    const updated = await backfillRanks(
      project._id,
      project.statuses.map((s) => s._id)
    );
    if (updated) console.log(`  ${project.key}: ${updated} tarefas ordenadas`);
  }
  console.log(`Projetos verificados: ${projects.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
