# DATA_SCHEMA.md — Local Persistence

SQLite is the single system of record for structured data; the filesystem stores binary artifacts; the DB stores their paths + hashes. This file is the DDL. Migrations are literal copies of these statements.

---

## 1. Engine & pragmas

Driver: `node:sqlite` (`import { DatabaseSync } from "node:sqlite"`, Deno ≥ 2.2). If the bundled build lacks FTS5 (check at boot with `SELECT fts5(?1)` probe), fall back to `jsr:@db/sqlite` which bundles FTS5 — the repo layer hides the driver behind one interface.

Applied at every open:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA cache_size = -20000;        -- 20 MiB page cache
```

IDs are **ULIDs** (26-char, lexically time-ordered — free chronological sort, no autoincrement contention). All times are `INTEGER` unix-ms UTC. All flexible payloads are `TEXT` JSON validated by zod at the repo boundary (SQLite `json_valid()` CHECK as a second fence).

---

## 2. Entity relationship overview

```
projects 1─* conversations 1─* messages
    │                │
    │                └─1─* runs 1─* run_steps
    │                        │
    ├────────1─*─────────────┴─* artifacts
    └─1─* code_versions ◄────────┘ (artifact.code_version_id)
settings (kv)   kb_docs + kb_fts (docs index)   events (log)   migrations
```

---

## 3. DDL

```sql
CREATE TABLE migrations (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, applied_at INTEGER NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,                      -- ulid
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  settings_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings_json))
  -- settings_json: { defaultMaterial, defaultVoxelSizeMm, envelopeMm:{x,y,z}, units:"mm" }
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX ix_conversations_project ON conversations(project_id, updated_at DESC);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  -- content_json: ordered block list, mirrors what the UI renders AND what is
  -- replayed to the model: [{t:'text',text}|{t:'brief',brief}|{t:'build',runId}
  --                         |{t:'geometry',artifactId}|{t:'error',code,msg}]
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  created_at INTEGER NOT NULL,
  tokens_in INTEGER, tokens_out INTEGER,
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1))
);
CREATE INDEX ix_messages_conv ON messages(conversation_id, created_at);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES messages(id) ON DELETE SET NULL, -- assistant msg hosting the build card
  state TEXT NOT NULL CHECK (state IN
    ('queued','briefing','codegen','compiling','executing','validating',
     'rendering','done','failed','cancelled')),
  attempt INTEGER NOT NULL DEFAULT 0,             -- repair-loop count
  error_code TEXT,                                 -- SYS_DESIGN §6 codes when failed
  error_detail TEXT,
  model TEXT NOT NULL,                             -- e.g. 'claude-sonnet-4-6'
  brief_json TEXT CHECK (brief_json IS NULL OR json_valid(brief_json)),
  limits_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(limits_json)),
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  total_ms INTEGER
);
CREATE INDEX ix_runs_conv ON runs(conversation_id, started_at DESC);
CREATE INDEX ix_runs_state ON runs(state) WHERE state IN ('queued','executing');
-- boot repair: UPDATE runs SET state='failed', error_code='ENGINE_LOST'
--              WHERE state NOT IN ('done','failed','cancelled');

CREATE TABLE run_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN
    ('llm','tool.search_docs','tool.submit_design_brief','tool.run_picogk',
     'tool.inspect_geometry','tool.capture_viewport','tool.export_artifact',
     'tool.ask_user','compile','execute','validate')),
  title TEXT NOT NULL,
  input_json TEXT CHECK (input_json IS NULL OR json_valid(input_json)),
  output_json TEXT CHECK (output_json IS NULL OR json_valid(output_json)),
  ok INTEGER CHECK (ok IN (0,1)),
  duration_ms INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE (run_id, seq)
);

CREATE TABLE code_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  parent_id TEXT REFERENCES code_versions(id),     -- repair lineage
  source TEXT NOT NULL,                            -- full generated .cs file
  source_hash TEXT NOT NULL,                       -- sha256 → engine DLL cache key
  params_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(params_json)),
  compile_ok INTEGER CHECK (compile_ok IN (0,1)),
  diagnostics_json TEXT CHECK (diagnostics_json IS NULL OR json_valid(diagnostics_json)),
  created_at INTEGER NOT NULL
);
CREATE INDEX ix_code_hash ON code_versions(source_hash);

CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  code_version_id TEXT REFERENCES code_versions(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('mesh','voxels','image','report','export')),
  format TEXT NOT NULL CHECK (format IN ('stl','glb','vdb','3mf','cli','png','json')),
  path TEXT NOT NULL,                              -- relative to ~/PicoForge
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  stats_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(stats_json)),
  -- mesh stats: {volumeCm3, areaCm2, bboxMm:{min:[],max:[]}, triangles,
  --              watertight, voxelSizeMm, minWallOkMm}
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
  created_at INTEGER NOT NULL
);
CREATE INDEX ix_artifacts_project ON artifacts(project_id, created_at DESC);
CREATE INDEX ix_artifacts_run ON artifacts(run_id);

-- Local knowledge base powering the search_docs tool
CREATE TABLE kb_docs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,           -- 'picogk_api' | 'kit' | 'recipes' | 'physics' | 'picogk_docs'
  title TEXT NOT NULL,
  section TEXT NOT NULL,
  content TEXT NOT NULL,          -- 200–500 token chunks
  meta_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(meta_json))
);
CREATE VIRTUAL TABLE kb_fts USING fts5(
  title, section, content, content='kb_docs', content_rowid='rowid',
  tokenize='porter unicode61'
);
-- keep in sync via triggers (AI on insert/update/delete of kb_docs)

CREATE TABLE settings (
  key TEXT PRIMARY KEY, value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  updated_at INTEGER NOT NULL
);
-- keys: model, temperature, maxRepairAttempts, voxelCellCapHard, voxelCellCapWarn,
--       runTimeoutS, maxRssMiB, retention{runsPerProject,maxBytes},
--       renderer{preferWebGPU:false, ptMaxSamples, ptEnabled}, telemetry:false

CREATE TABLE events (                              -- structured app log (ring-pruned)
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL, level TEXT NOT NULL CHECK (level IN ('debug','info','warn','error')),
  area TEXT NOT NULL, message TEXT NOT NULL,
  data_json TEXT CHECK (data_json IS NULL OR json_valid(data_json))
);
CREATE INDEX ix_events_ts ON events(ts);
```

---

## 4. Query patterns the schema must serve fast (verify with EXPLAIN in tests)

1. Hydrate a conversation: last 50 `messages` + their `runs` + `geometry` artifacts — 3 indexed queries, < 5 ms.
2. Resume viewport: latest `artifacts WHERE kind='mesh' AND run.state='done'` for a conversation.
3. Repair loop context: `code_versions` chain by `parent_id` + diagnostics for the current run.
4. Engine DLL cache probe: `code_versions WHERE source_hash=?`.
5. Docs tool: `SELECT ... FROM kb_fts WHERE kb_fts MATCH ? ORDER BY bm25(kb_fts) LIMIT 6`.
6. Boot orphan repair (see runs DDL comment) — must run before the server accepts traffic.

## 5. Transactions

Rule: one user-visible state change = one transaction. E.g. finishing a run: `UPDATE runs`, `INSERT artifacts×N`, `INSERT run_steps`, `UPDATE messages.content_json` in a single `BEGIN IMMEDIATE`. The repo layer exposes `withTx(fn)`; nesting is a programmer error (assert).

## 6. Migrations

Plain numbered SQL files applied in order inside one transaction each; `migrations` table records them. Never edit an applied migration; always add. `deno task db:reset` (dev only) deletes the DB, not the artifacts.

## 7. Retention / GC

Nightly at boot-idle: delete `runs` (and cascade steps) beyond `retention.runsPerProject` per project **except** runs owning pinned artifacts/messages; delete orphaned artifact files (path on disk without DB row and vice versa — reconcile both directions, DB wins); prune `events` older than 14 days; `VACUUM` if freelist > 20 %.

## 8. Backup story

Everything under `~/PicoForge/` is the backup unit. `sqlite3 picoforge.db ".backup"` equivalent exposed as Settings → "Export data" (zips db snapshot + projects dir).
