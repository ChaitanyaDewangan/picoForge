-- Migration 0001: Initial schema
-- DATA_SCHEMA §3 — full DDL.
-- Applied once at boot inside a transaction; recorded in migrations table.

CREATE TABLE IF NOT EXISTS migrations (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL UNIQUE,
  applied_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id            TEXT    PRIMARY KEY,                     -- ulid
  name          TEXT    NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  archived      INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  settings_json TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(settings_json))
  -- settings_json: { defaultMaterial, defaultVoxelSizeMm, envelopeMm:{x,y,z}, units:"mm" }
);

CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT    PRIMARY KEY,
  project_id  TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL DEFAULT 'Untitled',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_conversations_project
  ON conversations(project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT    PRIMARY KEY,
  conversation_id TEXT    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT    NOT NULL CHECK (role IN ('user','assistant','system')),
  -- content_json: ordered block list mirroring UI render + model replay:
  --   [{t:'text',text}|{t:'brief',brief}|{t:'build',runId}
  --    |{t:'geometry',artifactId}|{t:'error',code,msg}]
  content_json    TEXT    NOT NULL CHECK (json_valid(content_json)),
  created_at      INTEGER NOT NULL,
  tokens_in       INTEGER,
  tokens_out      INTEGER,
  pinned          INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1))
);
CREATE INDEX IF NOT EXISTS ix_messages_conv
  ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS runs (
  id              TEXT    PRIMARY KEY,
  conversation_id TEXT    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id      TEXT    REFERENCES messages(id) ON DELETE SET NULL,
  state           TEXT    NOT NULL CHECK (state IN (
    'queued','briefing','codegen','compiling','executing','validating',
    'rendering','done','failed','cancelled'
  )),
  attempt         INTEGER NOT NULL DEFAULT 0,
  error_code      TEXT,
  error_detail    TEXT,
  model           TEXT    NOT NULL,
  brief_json      TEXT    CHECK (brief_json IS NULL OR json_valid(brief_json)),
  limits_json     TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(limits_json)),
  started_at      INTEGER NOT NULL,
  finished_at     INTEGER,
  total_ms        INTEGER
);
CREATE INDEX IF NOT EXISTS ix_runs_conv
  ON runs(conversation_id, started_at DESC);
CREATE INDEX IF NOT EXISTS ix_runs_state
  ON runs(state) WHERE state IN ('queued','executing');
-- Boot orphan repair (applied in supervisor.ts before serving traffic):
-- UPDATE runs SET state='failed', error_code='ENGINE_LOST'
-- WHERE state NOT IN ('done','failed','cancelled');

CREATE TABLE IF NOT EXISTS run_steps (
  id          TEXT    PRIMARY KEY,
  run_id      TEXT    NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,
  kind        TEXT    NOT NULL CHECK (kind IN (
    'llm','tool.search_docs','tool.submit_design_brief','tool.run_picogk',
    'tool.inspect_geometry','tool.capture_viewport','tool.export_artifact',
    'tool.ask_user','compile','execute','validate'
  )),
  title       TEXT    NOT NULL,
  input_json  TEXT    CHECK (input_json  IS NULL OR json_valid(input_json)),
  output_json TEXT    CHECK (output_json IS NULL OR json_valid(output_json)),
  ok          INTEGER CHECK (ok IN (0,1)),
  duration_ms INTEGER,
  created_at  INTEGER NOT NULL,
  UNIQUE (run_id, seq)
);

CREATE TABLE IF NOT EXISTS code_versions (
  id              TEXT    PRIMARY KEY,
  project_id      TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_id          TEXT    REFERENCES runs(id) ON DELETE SET NULL,
  parent_id       TEXT    REFERENCES code_versions(id),     -- repair lineage
  source          TEXT    NOT NULL,                          -- full generated .cs file
  source_hash     TEXT    NOT NULL,                          -- sha256 → engine DLL cache key
  params_json     TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(params_json)),
  compile_ok      INTEGER CHECK (compile_ok IN (0,1)),
  diagnostics_json TEXT   CHECK (diagnostics_json IS NULL OR json_valid(diagnostics_json)),
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_code_hash ON code_versions(source_hash);

CREATE TABLE IF NOT EXISTS artifacts (
  id               TEXT    PRIMARY KEY,
  project_id       TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_id           TEXT    REFERENCES runs(id) ON DELETE SET NULL,
  code_version_id  TEXT    REFERENCES code_versions(id) ON DELETE SET NULL,
  kind             TEXT    NOT NULL CHECK (kind IN ('mesh','voxels','image','report','export')),
  format           TEXT    NOT NULL CHECK (format IN ('stl','glb','vdb','3mf','cli','png','json')),
  path             TEXT    NOT NULL,                         -- relative to ~/PicoForge
  size_bytes       INTEGER NOT NULL,
  sha256           TEXT    NOT NULL,
  stats_json       TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(stats_json)),
  -- mesh stats: {volumeCm3, areaCm2, bboxMm:{min:[],max:[]}, triangles, watertight, voxelSizeMm, minWallOkMm}
  pinned           INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
  created_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_artifacts_project
  ON artifacts(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_artifacts_run ON artifacts(run_id);

-- Local knowledge base for the search_docs tool (LLM_HARNESS §5.1)
CREATE TABLE IF NOT EXISTS kb_docs (
  id        TEXT    PRIMARY KEY,
  source    TEXT    NOT NULL,   -- 'picogk_api'|'kit'|'recipes'|'physics'|'picogk_docs'
  title     TEXT    NOT NULL,
  section   TEXT    NOT NULL,
  content   TEXT    NOT NULL,   -- 200-500 token chunks
  meta_json TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(meta_json))
);

CREATE VIRTUAL TABLE IF NOT EXISTS kb_fts USING fts5(
  title, section, content,
  content='kb_docs',
  content_rowid='rowid',
  tokenize='porter unicode61'
);

-- FTS sync triggers
CREATE TRIGGER IF NOT EXISTS kb_docs_ai AFTER INSERT ON kb_docs BEGIN
  INSERT INTO kb_fts(rowid, title, section, content)
    VALUES (new.rowid, new.title, new.section, new.content);
END;
CREATE TRIGGER IF NOT EXISTS kb_docs_au AFTER UPDATE ON kb_docs BEGIN
  INSERT INTO kb_fts(kb_fts, rowid, title, section, content)
    VALUES ('delete', old.rowid, old.title, old.section, old.content);
  INSERT INTO kb_fts(rowid, title, section, content)
    VALUES (new.rowid, new.title, new.section, new.content);
END;
CREATE TRIGGER IF NOT EXISTS kb_docs_ad AFTER DELETE ON kb_docs BEGIN
  INSERT INTO kb_fts(kb_fts, rowid, title, section, content)
    VALUES ('delete', old.rowid, old.title, old.section, old.content);
END;

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT    PRIMARY KEY,
  value_json TEXT    NOT NULL CHECK (json_valid(value_json)),
  updated_at INTEGER NOT NULL
);
-- Keys: model, temperature, maxRepairAttempts, voxelCellCapHard, voxelCellCapWarn,
--       runTimeoutS, maxRssMiB, retention{runsPerProject,maxBytes},
--       renderer{preferWebGPU,ptMaxSamples,ptEnabled}, telemetry

CREATE TABLE IF NOT EXISTS events (
  id        INTEGER PRIMARY KEY,
  ts        INTEGER NOT NULL,
  level     TEXT    NOT NULL CHECK (level IN ('debug','info','warn','error')),
  area      TEXT    NOT NULL,
  message   TEXT    NOT NULL,
  data_json TEXT    CHECK (data_json IS NULL OR json_valid(data_json))
);
CREATE INDEX IF NOT EXISTS ix_events_ts ON events(ts);
