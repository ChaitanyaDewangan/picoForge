# MCP_SERVER.md — PicoForge as an MCP Server ("Bring Your Own Model" Mode)

Add this file to `docs/`. Registrar notes for the implementing agent: add one row to README.md's doc map, add milestone **M9** to AGENTS.md §4 with the gate defined in §10 below, and add migration `0002` from §6. Everything else in the pack stays valid.

---

## 1. Concept

PicoForge has two ways to think:

| Mode | Who is the model | Who enforces the rules |
|---|---|---|
| **Internal** (LLM_HARNESS.md) | The built-in Anthropic client (`anthropic.ts`) | The harness |
| **MCP** (this doc) | Whatever model the connecting agent runs — Claude Code brings Claude, Codex brings its OpenAI models, Gemini CLI / Antigravity brings Gemini | **The same harness** |

In MCP mode, PicoForge stops being a chat app with a model inside and becomes a **disciplined geometry appliance**: an external coding agent connects over the Model Context Protocol, and its model plays the exact role the internal Claude plays — same tools, same design-brief gate, same code contract, same validation ladder, same typed repair payloads. The deterministic machinery (brief validator, analyzer, compiler, sandbox, geometry checks, viewport) never moves; only the "brains" is external and interchangeable.

The desktop app remains the visual surface: every MCP-driven run appears live in the open UI as a build card tagged with its origin (e.g. `via MCP · claude-code`), and successful geometry loads into the ray-traced viewport automatically. An engineer can watch Codex build a turbine in their viewport — that is the demo.

**Non-goals:** MCP mode does not expose raw engine RPC, does not accept arbitrary process/file operations, and does not relax a single rung of the validation ladder. A less careful external model gets *more* enforcement, not less.

---

## 2. Architecture

```
Claude Code / Codex / Gemini CLI / Antigravity …          (agent supplies the model)
        │  MCP (stdio  or  Streamable HTTP /mcp)
        ▼
┌─ DENO SERVER ─────────────────────────────────────────────┐
│  server/mcp/                                              │
│    server.ts      MCP server (npm:@modelcontextprotocol/  │
│                   sdk) — tools + resources + prompts      │
│    adapter.ts     thin mapping onto EXISTING executors    │
│    session.ts     MCP session ↔ project/conversation bind │
│  harness/tools/*  ◄── unchanged, shared by both modes     │
│  ws hub           ◄── mirrors MCP runs into the open UI   │
└───────────┬───────────────────────────────────────────────┘
            ▼ existing path: engine host → sandbox → PicoGK
```

Design law: `server/mcp/` is an **adapter, not a fork**. Tool logic lives once in `harness/tools/*`; the MCP layer only translates protocol frames, sessions, and progress. If a behavior exists in MCP mode but not internal mode (or vice versa), that is a bug.

Transports: **stdio** (spawned by the agent: `picoforged --mcp`) and **Streamable HTTP** at `http://127.0.0.1:7317/mcp` on the existing server (localhost-only, `X-PicoForge-Token` required — SYS_DESIGN §10). The stdio binary does not run its own engine: it connects to the running app's HTTP/WS internally so the UI stays the single source of truth; if the app isn't running, it boots headless (viewport-dependent features degrade per §5). Implementer: verify current SDK/transport specifics against https://modelcontextprotocol.io before wiring — protocol details drift; the spec site wins.

---

## 3. Sessions

On `initialize`, the server binds the MCP session to a **project** (client may pass `projectId`/`projectName` in `open_project`; default: a project named after the MCP client, created if absent) and opens one conversation per session. All persistence is identical to UI usage: `runs`, `run_steps`, `code_versions`, `artifacts` rows, with `origin` recording the client (§6). Concurrency rule is unchanged — one active run per project; a second `run_picogk` while one is live returns typed `RUN_BUSY {activeRunId, etaHint}` (agents handle this fine; never silently queue an external caller).

---

## 4. Exposed surface

### 4.1 Tools (names and schemas are the LLM_HARNESS §5 schemas, verbatim)

`search_docs` · `submit_design_brief` · `run_picogk` · `inspect_geometry` · `capture_viewport` · `export_artifact` — plus three MCP-only session tools:

```
open_project      { projectName?, projectId?, material?, envelopeMm? } → project + defaults
get_run           { runId } → state, stats, warnings, logTail (poll/verify)
show_artifact     { artifactId } → loads it into the open viewport (returns stats)
```

`ask_user` is **not** exposed: in MCP mode the connecting agent owns its human channel. Where the internal harness would inject an ask_user handoff (budget exhausted), the MCP result instead returns `code:"NEEDS_DECISION"` with the same options array — the agent relays to its own user.

Tool-description discipline (this is what makes any model behave): `run_picogk`'s description embeds the condensed Code Contract (one pure `Design.voxBuild(Ctx)`, allowed usings, banned APIs, mm/Z-up conventions) and states plainly: *"Calls without an accepted design brief in this session are rejected with BRIEF_REQUIRED."* `submit_design_brief`'s description names the category-required physics checks. Long-form doctrine lives in resources/prompts (§4.2–4.3) — descriptions stay under ~150 tokens each so they survive every client's context policy.

### 4.2 Resources (read-only; URIs stable)

```
picoforge://rules/system            the FORGE doctrine (LLM_HARNESS §3, model-agnostic wording)
picoforge://api/picogk-card         generated from picogk_api.json (live, per installed version)
picoforge://api/kit-card            PicoForge.Kit signatures
picoforge://kb/recipes/{category}   rotor_fan, bracket, heat_exchanger, …
picoforge://kb/physics              formula pack (PICOGK_KNOWLEDGE §5)
picoforge://kb/materials            materials table (JSON)
picoforge://session/brief           latest accepted brief (JSON)
picoforge://session/last-run        latest run report (stats, warnings, code header)
picoforge://code/{codeVersionId}    full source of any attempt (diff-able by the agent)
```

### 4.3 Prompts

`forge_engineer` — the bootstrap. Returns the full working doctrine (loop order: understand → brief → build → verify → report; contract; conventions; repair etiquette) parameterized with the session's project defaults. First line of the prompt instructs the agent to read `picoforge://api/picogk-card` before writing code. Also expose `forge_repair` (renders the LLM_HARNESS §8 repair template for a given failed run) so clients with weak error-handling loops can ask for the exact fix-it framing.

---

## 5. Enforcement parity (the point of the whole doc)

1. **Brief gate is server-side state, not model memory.** `run_picogk` without an accepted brief in the session → `BRIEF_REQUIRED` (+ pointer to the tool and the category table). Brief deltas merge exactly as LLM_HARNESS §10.
2. **Ladder unchanged.** L0 lint → L1 compile → L2 guarded run → L3 geometry, identical codes and payloads (LLM_HARNESS §7). Every failure includes the same `repairHint`, computed by the same `nextRepairHint`, with the attempt counter tracked **server-side per brief** — external agents cannot reset it by reconnecting.
3. **Budgets become server enforcement.** Internal mode bounds the loop in the orchestrator; MCP mode enforces the same numbers as hard caps: per-brief attempts (compile 3 / runtime 2 / validation 2), 14 build-tool calls per brief, and a session rate limit (default 6 `run_picogk`/min). Exceeding → `NEEDS_DECISION` with simplification options (never a silent 429).
4. **Sandbox posture identical.** Same analyzer, same limits, same disposable child. There is no "trusted client" flag.
5. **Long-running calls stream.** `run_picogk` reports MCP progress notifications (compile → execute % from `ctx.Progress` → validate) and returns the final result; clients that ignore progress still get a correct blocking call. `capture_viewport` requires the desktop UI; headless sessions get the deterministic text fallback (LLM_HARNESS §5.5) — never an error.
6. **UI mirroring.** Every MCP run emits the standard WS events, so build cards, DRO, and viewport behave as if the internal model did it. `origin` renders as a small mono chip on the card.

---

## 6. Persistence delta (migration `0002_mcp_origin.sql`)

```sql
ALTER TABLE runs          ADD COLUMN origin TEXT NOT NULL DEFAULT 'ui';   -- 'ui' | 'mcp:<clientName>'
ALTER TABLE conversations ADD COLUMN origin TEXT NOT NULL DEFAULT 'ui';
CREATE TABLE mcp_sessions (
  id TEXT PRIMARY KEY, client_name TEXT NOT NULL, client_version TEXT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  brief_attempts_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(brief_attempts_json)),
  created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL
);
```

Retention: `mcp_sessions` older than 7 days idle are pruned; their runs/artifacts follow normal DATA_SCHEMA §7 rules.

---

## 7. Client configuration (document these in README; verify each client's current syntax against its own docs — they change)

```jsonc
// Claude Code (.mcp.json, project scope)
{ "mcpServers": { "picoforge": { "command": "picoforged", "args": ["--mcp"] } } }
```
```toml
# Codex (~/.codex/config.toml)
[mcp_servers.picoforge]
command = "picoforged"
args    = ["--mcp"]
```
```jsonc
// Gemini CLI / Antigravity (settings mcpServers) — HTTP form against a running app
{ "mcpServers": { "picoforge": {
    "httpUrl": "http://127.0.0.1:7317/mcp",
    "headers": { "X-PicoForge-Token": "<printed by the app at boot>" } } } }
```

Recommended first message for any client (put this in README's MCP section): *"Load the `forge_engineer` prompt from picoforge, open project X, then build …"*

---

## 8. Security

Localhost bind + token unchanged (SYS_DESIGN §10). Stdio spawn reads the token from `~/PicoForge/secret.env`; HTTP requires the header. MCP mode never exposes: settings write, API-key access, filesystem paths outside artifact URLs, engine RPC, or code execution outside the contract. Log every session (`events` area `mcp`) with client name/version; no payload secrets.

---

## 9. Implementation notes (Milestone M9 — after M6; M7/M8 may land either side)

`server/mcp/` ≈ 400 lines total if the adapter rule is respected (ponytail: the executors, validator, ladder, and WS mirroring all already exist — reuse, don't rewrite). SDK via `npm:@modelcontextprotocol/sdk` on Deno; register tools from the same zod schemas that generate the Anthropic JSON schemas (one schema source, two protocol emitters). Add `--mcp` flag to `main.ts` (stdio transport, connect-or-boot-headless). Resources are renderers over existing data (prompt builders, kb tables, repo queries) — no new state.

## 10. Acceptance gate (M9)

1. MCP Inspector: lists 9 tools, all resources/prompts render; schema round-trips validate.
2. Claude Code session: load `forge_engineer` → `open_project` → brief → `run_picogk` → geometry appears in the **open desktop viewport** with origin chip; STL exported. Repeat the same scripted flow from Codex and from Gemini CLI/Antigravity — three different vendor models through one harness, zero code changes between them.
3. Enforcement drills: `run_picogk` before brief → `BRIEF_REQUIRED`; 4th compile failure → `NEEDS_DECISION` with options; concurrent run → `RUN_BUSY`; reconnect does not reset attempt counters; headless `capture_viewport` returns the text fallback.
4. Golden MCP transcript added to the harness test suite (mock client, real engine): fan build ≤ 1 repair, all frames schema-valid.