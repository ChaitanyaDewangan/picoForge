// server/db/db.ts — SQLite database with WAL mode + migration runner
// Driver: node:sqlite (Deno ≥ 2.2); DATA_SCHEMA §1

import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { makeLogger } from "../log.ts";

const log = makeLogger("db");

// node:sqlite types — Deno ships this natively since 2.2
// Minimal structural interface to avoid `any` while remaining driver-agnostic
interface DatabaseSync {
  exec(sql: string): void;
  prepare(sql: string): { get(...args: unknown[]): unknown; run(...args: unknown[]): void };
  close?(): void;
}
let DatabaseSyncCtor: new (path: string) => DatabaseSync;

interface SqliteModule {
  DatabaseSync?: new (path: string) => DatabaseSync;
  default?: new (path: string) => DatabaseSync;
  Database?: new (path: string) => DatabaseSync;
}

async function loadDriver(): Promise<new (path: string) => DatabaseSync> {
  if (DatabaseSyncCtor) return DatabaseSyncCtor;
  try {
    const mod = await (eval('import("node:sqlite")') as Promise<SqliteModule>);
    DatabaseSyncCtor = mod.DatabaseSync!;
    return DatabaseSyncCtor;
  } catch {
    // Fallback: jsr:@db/sqlite (bundles FTS5) per DATA_SCHEMA §1
    const mod = await (eval('import("jsr:@db/sqlite")') as Promise<SqliteModule>);
    DatabaseSyncCtor = (mod.default ?? mod.Database)!;
    return DatabaseSyncCtor;
  }
}

let _db: DatabaseSync | null = null;

/** Apply WAL pragmas — called every open */
function applyPragmas(db: DatabaseSync): void {
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA cache_size = -20000;");
}

/** Run a migration SQL file inside a transaction */
function applyMigration(db: DatabaseSync, name: string, sql: string): void {
  const already = db
    .prepare("SELECT 1 FROM migrations WHERE name = ?")
    .get(name);
  if (already) return;
  db.exec("BEGIN;");
  try {
    db.exec(sql);
    db.prepare("INSERT INTO migrations(name, applied_at) VALUES (?,?)").run(
      name,
      Date.now(),
    );
    db.exec("COMMIT;");
    log.info("Migration applied", { name });
  } catch (e) {
    db.exec("ROLLBACK;");
    throw e;
  }
}

/** Open the DB, apply WAL pragmas, run pending migrations, return the handle */
export async function openDb(dataDir: string): Promise<DatabaseSync> {
  if (_db) return _db;

  const Ctor = await loadDriver();
  const dbPath = join(dataDir, "picoforge.db");
  const db = new Ctor(dbPath);
  applyPragmas(db);

  // Bootstrap: create migrations table if not present (needed before first migration)
  db.exec(`CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    applied_at INTEGER NOT NULL
  );`);

  // Read and apply migration files in order
  const migrationsDir = new URL("./migrations", import.meta.url).pathname;
  const entries: string[] = [];
  for await (const entry of Deno.readDir(migrationsDir)) {
    if (entry.isFile && entry.name.endsWith(".sql")) {
      entries.push(entry.name);
    }
  }
  entries.sort();

  for (const name of entries) {
    const sql = await Deno.readTextFile(join(migrationsDir, name));
    applyMigration(db, name, sql);
  }

  // Verify FTS5 is available
  try {
    db.exec("SELECT fts5('test')");
  } catch {
    // FTS5 not available in this build — acceptable, search_docs will degrade gracefully
    log.warn("FTS5 not available in this SQLite build — search_docs will return empty results");
  }

  _db = db;
  log.info("Database opened", { path: dbPath });
  return db;
}

export function getDb(): DatabaseSync {
  if (!_db) throw new Error("DB not initialized — call openDb() first");
  return _db;
}

/**
 * Execute fn inside a single transaction.
 * One user-visible state change = one transaction (DATA_SCHEMA §5).
 * Nesting is a programmer error.
 */
export function withTx<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE;");
  try {
    const result = fn(db);
    db.exec("COMMIT;");
    return result;
  } catch (e) {
    db.exec("ROLLBACK;");
    throw e;
  }
}
