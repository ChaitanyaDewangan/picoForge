# PicoForge

> A local desktop web app where you tell an AI agent *"build a turbine for my fan"* and it designs the part using real mechanical-engineering math, writes PicoGK (C#) code, compiles and runs it in a sandbox, validates the geometry, and streams the result into a ray-traced 3D viewport — all on your own machine.

---

## Architecture

```
┌──────────────┐   HTTP/WS :7317    ┌──────────────────────┐
│   BROWSER    │◄──────────────────►│   DENO SERVER        │
│  React+three │   /api  /ws /files │   "forged"           │───► api.anthropic.com
└──────────────┘                    │  ├ Hono router       │    (or OpenCode)
       ▲                            │  ├ WS hub            │
       │ opens                      │  ├ Harness (LLM SM)  │
  desktop window                    │  ├ SQLite            │
  (chromium --app=)                 │  └ EngineClient      │
                                    └─────────┬────────────┘
                                      stdio ndjson JSON-RPC
                                    ┌─────────▼────────────┐
                                    │  ENGINE HOST (.NET 9) │
                                    │  ├ Roslyn compiler    │
                                    │  └ Sandbox pool mgr   │
                                    └──────────────────────┘
```

Three isolated OS processes communicate via typed boundaries:
- **Browser** — React 19 + three.js viewport with progressive path tracing
- **Deno Server** — Hono HTTP/WS, LLM harness orchestrator, SQLite persistence
- **Engine Host** — .NET 9 Roslyn compiler + PicoGK v2.2 sandbox children

---

## 5. Quickstart

### Prerequisites

```sh
deno --version        # >= 2.2
dotnet --version      # >= 9.0 SDK (optional — server runs in degraded mode without it)
node --version        # >= 18 (for Vite frontend build)
# GPU: anything with WebGL2. Path tracing auto-scales; RTX-class cards get full quality.
```

### Setup

```sh
git clone <repo> picoforge && cd picoforge
```

**Option A — One-click (Windows 11):**

```bat
start.bat
```

This script:
1. Checks prerequisites (Deno, Node)
2. Creates `.env` with the configured API key
3. Installs `app/` npm dependencies if needed
4. Starts the Deno server on `http://127.0.0.1:7317`
5. Starts the Vite dev server on `http://localhost:5173`
6. Opens the browser automatically

**Option B — Manual:**

```sh
cd picoforge
cp .env.example .env               # put ANTHROPIC_API_KEY here
                                   # optionally set ANTHROPIC_BASE_URL for OpenCode

deno task setup                    # dotnet restore, build engine, generate symbol table,
                                   # ingest docs into SQLite FTS

deno task dev                      # server :7317 + Vite HMR, opens the app window
```

### Development commands

```sh
deno task check                    # fmt + lint + typecheck + all tests (CI gate)
deno task test                     # run test suite only
deno task build                    # production build → picoforged.exe
```

### Self-test

```sh
deno run --allow-all server/main.ts --selftest
```

Verifies engine connectivity and exits with code 0 (pass) or 1 (fail).

### First run

The first launch walks you through:
1. API key configuration
2. Engine self-test (compiles & runs a 10mm cube through the full pipeline)
3. GPU benchmark for viewport tier assignment
4. Ready to chat!

---

## Configuration

All configuration is via environment variables in `.env`:

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic or OpenCode API key |
| `ANTHROPIC_BASE_URL` | No | Custom API endpoint (e.g., `https://api.opencode.so/v1`) |
| `PORT` | No | Server port (default: `7317`) |
| `PICOFORGE_DATA_DIR` | No | Data directory (default: `~/PicoForge`) |

---

## Data & Uninstall

Everything lives under `~/PicoForge/` (or `PICOFORGE_DATA_DIR`):
- `picoforge.db` — SQLite database (conversations, runs, settings)
- `artifacts/` — Generated meshes, captures, exports
- `kb/` — Ingested documentation for FTS search

Deleting that folder is a complete uninstall of user data.

---

## Project structure

```
picoforge/
├── app/                    # React 19 + Vite frontend
│   └── src/
│       ├── chat/           # MessageList, Composer, BuildCard, BriefCard
│       ├── panels/         # ConsoleDrawer, SettingsDialog, FirstRunWizard
│       ├── viewport/       # ViewportEngine (three.js), HUD overlays, PT
│       ├── state/          # chatStore (useReducer)
│       └── ws/             # WebSocket client with reconnect/resume
├── server/                 # Deno backend
│   ├── db/                 # SQLite repos, migrations, GC
│   ├── domain/             # Typed events, Result<T,E>, IDs
│   ├── engine/             # EngineClient (ndjson RPC), Supervisor
│   ├── harness/            # LLM orchestrator, tools, prompts, brief validator
│   ├── http/               # Hono router, WS hub, static files
│   └── main.ts             # Entry point
├── scripts/                # build.ts, setup.ts
├── KNOWLEDGE_BASE/         # Specification pack (normative)
└── start.bat               # One-click Windows launcher
```

---

## Testing

```sh
deno task check              # Full CI gate: format, lint, typecheck, tests
deno task test               # Tests only (63 tests)
```

Test coverage includes:
- **Unit**: Brief validator rules, prompt renderers, DB repos, chat reducer
- **Golden transcripts**: Mock-model orchestrator runs covering all failure modes
- **System prompt**: Token budget assertions, placeholder-free rendering
- **Protocol**: Zod schema round-trips for all WS/HTTP events

---

## Technology stack

| Layer | Choice |
|---|---|
| Runtime / Server | Deno 2.x, Hono, SQLite (node:sqlite) |
| Frontend | React 19, Vite, Base UI, hand-written CSS tokens |
| 3D Viewport | three.js, camera-controls, three-gpu-pathtracer |
| Geometry Kernel | PicoGK v2.2 (.NET 9, headless) |
| LLM | Anthropic Messages API (configurable endpoint) |
| Packaging | `deno compile` + `dotnet publish` |

---

## License

See LICENSE file.
