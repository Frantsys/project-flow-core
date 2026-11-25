// sem "server-only": os scripts (seed, migração) também usam
import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";
import { Types } from "mongoose";
import { Task } from "../db/models";

/**
 * Ordem das tarefas dentro da coluna com índice fracionário: cada tarefa tem um `rank` (texto) e
 * mover uma tarefa grava só ela, com um rank entre os dois vizinhos.
 */

type Id = Types.ObjectId | string;

/** Rank para entrar no fim da coluna. */
export async function rankAtEnd(projectId: Id, statusId: Id) {
  const last = await Task.findOne({ projectId, statusId, rank: { $gt: "" } })
    .sort({ rank: -1 })
    .select("rank")
    .lean<{ rank: string }>();
  return generateKeyBetween(last?.rank ?? null, null);
}

/** Regrava os ranks de uma coluna na ordem dada (usado quando os vizinhos empatam). */
async function rerank(orderedIds: Types.ObjectId[]) {
  const keys = generateNKeysBetween(null, null, orderedIds.length);
  await Task.bulkWrite(
    orderedIds.map((_id, i) => ({ updateOne: { filter: { _id }, update: { $set: { rank: keys[i] } } } }))
  );
}

/**
 * Coloca a tarefa na coluna `statusId`, logo depois de `afterTaskId` (null = no topo), e devolve
 * o rank gravado. Calcula a partir da coluna atual do banco, não de valores enviados pelo cliente.
 */
export async function placeTask(
  task: { _id: Types.ObjectId; projectId: Types.ObjectId },
  statusId: Id,
  afterTaskId: string | null
) {
  const column = await Task.find({ projectId: task.projectId, statusId, _id: { $ne: task._id } })
    .sort({ rank: 1, createdAt: 1 })
    .select("_id rank")
    .lean<{ _id: Types.ObjectId; rank: string }[]>();

  const index = afterTaskId ? column.findIndex((t) => t._id.toString() === afterTaskId) + 1 : 0;
  const prev = column[index - 1]?.rank || null;
  const next = column[index]?.rank || null;

  // vizinhos sem rank ou empatados (criações simultâneas): reordena a coluna inteira
  if ((index > 0 && !prev) || (next && prev && prev >= next) || (index < column.length && !next)) {
    const ids = column.map((t) => t._id);
    ids.splice(index, 0, task._id);
    await rerank(ids);
    const saved = await Task.findById(task._id).select("rank").lean<{ rank: string }>();
    return saved!.rank;
  }

  const rank = generateKeyBetween(prev, next);
  await Task.updateOne({ _id: task._id }, { $set: { rank } });
  return rank;
}

/** Dá rank às tarefas que ainda não têm (dados antigos e seed), por ordem de criação. */
export async function backfillRanks(projectId: Id, statusIds: Id[]) {
  let updated = 0;
  for (const statusId of statusIds) {
    const missing = await Task.find({
      projectId,
      statusId,
      $or: [{ rank: "" }, { rank: { $exists: false } }],
    })
      .sort({ createdAt: 1 })
      .select("_id")
      .lean<{ _id: Types.ObjectId }[]>();
    if (missing.length === 0) continue;
    const last = await Task.findOne({ projectId, statusId, rank: { $gt: "" } })
      .sort({ rank: -1 })
      .select("rank")
      .lean<{ rank: string }>();
    const keys = generateNKeysBetween(last?.rank ?? null, null, missing.length);
    await Task.bulkWrite(
      missing.map(({ _id }, i) => ({ updateOne: { filter: { _id }, update: { $set: { rank: keys[i] } } } }))
    );
    updated += missing.length;
  }
  return updated;
}
