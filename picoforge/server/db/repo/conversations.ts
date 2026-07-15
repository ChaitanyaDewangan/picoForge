// server/db/repo/conversations.ts — Conversation repository
// DATA_SCHEMA §3 + §5

import { ulid } from "../../domain/ids.ts";
import { getDb, withTx } from "../db.ts";

export interface Conversation {
  id: string;
  projectId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

function rowToConversation(row: unknown): Conversation {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    title: r.title as string,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
  };
}

export function conversationCreate(projectId: string, title = "Untitled"): Conversation {
  const now = Date.now();
  const id = ulid();
  withTx((db) => {
    db.prepare(
      `INSERT INTO conversations(id,project_id,title,created_at,updated_at)
       VALUES (?,?,?,?,?)`,
    ).run(id, projectId, title, now, now);
    db.prepare("UPDATE projects SET updated_at=? WHERE id=?").run(now, projectId);
  });
  return { id, projectId, title, createdAt: now, updatedAt: now };
}

export function conversationList(projectId: string): Conversation[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM conversations WHERE project_id=? ORDER BY updated_at DESC",
    )
    .all(projectId);
  return rows.map(rowToConversation);
}

export function conversationGet(id: string): Conversation | undefined {
  const row = getDb().prepare("SELECT * FROM conversations WHERE id=?").get(id);
  return row ? rowToConversation(row) : undefined;
}

export function conversationUpdateTitle(id: string, title: string): void {
  const now = Date.now();
  withTx((db) => {
    db.prepare("UPDATE conversations SET title=?,updated_at=? WHERE id=?").run(title, now, id);
  });
}
