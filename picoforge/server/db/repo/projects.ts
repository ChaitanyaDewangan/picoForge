// server/db/repo/projects.ts — Project repository
// DATA_SCHEMA §3 + §5: typed repo, all writes via withTx

import { z } from "zod";
import { ulid } from "../../domain/ids.ts";
import { getDb, withTx } from "../db.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export const ProjectSettingsSchema = z.object({
  defaultMaterial: z.string().optional(),
  defaultVoxelSizeMm: z.number().positive().optional(),
  envelopeMm: z
    .object({ x: z.number().positive(), y: z.number().positive(), z: z.number().positive() })
    .optional(),
  units: z.literal("mm").optional(),
});
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  settings: ProjectSettings;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToProject(row: unknown): Project {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    name: r.name as string,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
    archived: (r.archived as number) !== 0,
    settings: ProjectSettingsSchema.parse(JSON.parse(r.settings_json as string)),
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function projectCreate(name: string, settings: ProjectSettings = {}): Project {
  const now = Date.now();
  const id = ulid();
  withTx((db) => {
    db.prepare(
      `INSERT INTO projects(id,name,created_at,updated_at,archived,settings_json)
       VALUES (?,?,?,?,0,?)`,
    ).run(id, name, now, now, JSON.stringify(settings));
  });
  return { id, name, createdAt: now, updatedAt: now, archived: false, settings };
}

export function projectList(): Project[] {
  const rows = getDb()
    .prepare("SELECT * FROM projects WHERE archived=0 ORDER BY updated_at DESC")
    .all();
  return rows.map(rowToProject);
}

export function projectGet(id: string): Project | undefined {
  const row = getDb().prepare("SELECT * FROM projects WHERE id=?").get(id);
  return row ? rowToProject(row) : undefined;
}

export function projectUpdate(
  id: string,
  patch: { name?: string; archived?: boolean; settings?: ProjectSettings },
): Project | undefined {
  const now = Date.now();
  return withTx((db) => {
    const existing = db.prepare("SELECT * FROM projects WHERE id=?").get(id);
    if (!existing) return undefined;
    const cur = rowToProject(existing);
    const name = patch.name ?? cur.name;
    const archived = patch.archived ?? cur.archived ? 1 : 0;
    const settings = patch.settings ?? cur.settings;
    db.prepare(
      `UPDATE projects SET name=?,archived=?,settings_json=?,updated_at=? WHERE id=?`,
    ).run(name, archived, JSON.stringify(settings), now, id);
    return { ...cur, name, archived: archived !== 0, settings, updatedAt: now };
  });
}

export function projectDelete(id: string): boolean {
  return withTx((db) => {
    const info = db.prepare("DELETE FROM projects WHERE id=?").run(id);
    return info.changes > 0;
  });
}
