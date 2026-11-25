import "server-only";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { DocumentModel, Project, Task, Workspace } from "../db/models";
import { normalizeText } from "@/lib/task-filters";

export interface SearchResultDTO {
  kind: "task" | "project" | "document" | "workspace";
  id: string;
  title: string;
  /** Linha de apoio: código da tarefa, workspace etc. */
  hint: string;
  href: string;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ACCENTS: Record<string, string> = {
  a: "[aáàâãä]",
  e: "[eéèêë]",
  i: "[iíìîï]",
  o: "[oóòôõö]",
  u: "[uúùûü]",
  c: "[cç]",
};

/** Regex que ignora acentos e maiúsculas: "revisao" encontra "Revisão" (o banco não normaliza). */
export function accentInsensitiveRegex(query: string) {
  const plain = normalizeText(query);
  return new RegExp([...plain].map((ch) => ACCENTS[ch] ?? escapeRegex(ch)).join(""), "i");
}

/**
 * Busca em todos os workspaces de que a pessoa é membro: tarefas (código ou título), projetos,
 * documentos e workspaces. shortcut: regex sem índice de texto, suficiente para centenas de
 * tarefas; trocar por Atlas Search quando o volume crescer (roadmap 4.3).
 */
export async function searchEverything(userId: string, query: string, limit = 6): Promise<SearchResultDTO[]> {
  const q = query.trim();
  if (q.length < 2 || !Types.ObjectId.isValid(userId)) return [];
  await dbConnect();

  const workspaces = await Workspace.find({ "members.userId": userId }).select("name slug").lean();
  if (workspaces.length === 0) return [];
  const wsById = new Map(workspaces.map((w) => [w._id.toString(), w]));
  const projects = await Project.find({ workspaceId: { $in: workspaces.map((w) => w._id) } })
    .select("workspaceId name key")
    .lean();
  const projectById = new Map(projects.map((p) => [p._id.toString(), p]));

  const re = accentInsensitiveRegex(q);
  const [tasks, docs] = await Promise.all([
    Task.find({ projectId: { $in: projects.map((p) => p._id) }, $or: [{ code: re }, { title: re }] })
      .select("projectId code title")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean(),
    DocumentModel.find({ workspaceId: { $in: workspaces.map((w) => w._id) }, title: re })
      .select("workspaceId title")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  const results: SearchResultDTO[] = [];
  for (const t of tasks) {
    const project = projectById.get(t.projectId.toString());
    const ws = project && wsById.get(project.workspaceId.toString());
    if (!project || !ws) continue;
    results.push({
      kind: "task",
      id: t._id.toString(),
      title: t.title,
      hint: `${t.code} · ${project.name}`,
      href: `/w/${ws.slug}/projects/${project.key}/tasks/${t.code}`,
    });
  }
  for (const p of projects.filter((p) => re.test(p.name) || re.test(p.key)).slice(0, limit)) {
    const ws = wsById.get(p.workspaceId.toString())!;
    results.push({
      kind: "project",
      id: p._id.toString(),
      title: p.name,
      hint: `${p.key} · ${ws.name}`,
      href: `/w/${ws.slug}/projects/${p.key}`,
    });
  }
  for (const d of docs) {
    const ws = wsById.get(d.workspaceId.toString());
    if (!ws) continue;
    results.push({
      kind: "document",
      id: d._id.toString(),
      title: d.title,
      hint: ws.name,
      href: `/w/${ws.slug}/docs/${d._id.toString()}`,
    });
  }
  for (const w of workspaces.filter((w) => re.test(w.name)).slice(0, limit)) {
    results.push({
      kind: "workspace",
      id: w._id.toString(),
      title: w.name,
      hint: `/${w.slug}`,
      href: `/w/${w.slug}`,
    });
  }
  return results;
}
