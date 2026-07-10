# SYS_DESIGN.md — PicoForge System Architecture

Normative. Every section number here is referenced from AGENTS.md milestones.

---

## 1. Design goals → architectural consequences

| Goal | Consequence |
|---|---|
| "No time for failure and no crashes" | Crash-only design: three isolated OS processes, supervision trees, disposable sandboxes, idempotent restarts, WAL SQLite. A crash anywhere degrades one run, never the app. |
| Sub-minute chat→part loop | Warm Roslyn compiler in a persistent host (~200 ms compiles), prewarmed sandbox child, streaming everything (tokens, logs, progress) over one WebSocket. |
| Consumer-GPU ray tracing | Rendering lives entirely in the browser (WebGL2 baseline). Hybrid raster/path-trace with GPU tiering — the server never renders. |
| LLM that is hard to fail | The harness is a deterministic state machine around the model; the model only ever fills one pure function and one structured brief. See LLM_HARNESS.md. |
| Local-first | One data root `~/PicoForge/`; only outbound network call is `api.anthropic.com`. |

---

## 2. Process topology

```
┌────────────────────────────  OS  ────────────────────────────────┐
│                                                                  │
│  ┌──────────────┐   HTTP/WS :7317    ┌──────────────────────┐    │
│  │   BROWSER    │◄──────────────────►│   DENO SERVER        │    │
│  │  React+three │   /api  /ws /files │   "forged"           │    │
│  │  (renders)   │                    │  ├ Hono router       │    │
│  └──────────────┘                    │  ├ WS hub            │    │
│        ▲                             │  ├ Harness (LLM SM)  │────┼──► api.anthropic.com
│        │ opens                       │  ├ SQLite (node:sqlite)   │    (HTTPS, streaming)
│  desktop window                      │  ├ EngineClient      │    │
│  (deno desktop /                     │  └ Supervisor        │    │
│   chromium --app=)                   └─────────┬────────────┘    │
│                                        stdio ndjson JSON-RPC     │
│                                      ┌─────────▼────────────┐    │
│                                      │  ENGINE HOST (.NET 9)│    │
│                                      │  "forge-engine"      │    │
│                                      │  ├ Roslyn compiler   │    │
│                                      │  ├ Symbol table      │    │
│                                      │  └ Sandbox pool mgr  │    │
│                                      └───────┬──────────────┘    │
│                                       spawn / stdio / kill       │
│                                      ┌────────▼─────────────┐    │
│                                      │ SANDBOX CHILD (.NET) │ ←─ disposable, 1 per run
│                                      │ loads PicoGK native  │    prewarmed spare kept
│                                      │ runs Design.voxBuild │                          
│                                      └──────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

**Why three processes, not two:** PicoGK's runtime is native C++ (OpenVDB 13). Native faults (segfault, bad_alloc) are not catchable in managed code. Only OS process isolation guarantees invariant #1. The *host* stays managed-only (Roslyn + supervision) and therefore effectively immortal; only the *child* ever loads `picogk.runtime`.

---

## 3. Deno server (`/server`)

### 3.1 Module map

```
server/
  main.ts               // entry: config load, migrations, supervisor start, Deno.serve
  config.ts             // env + settings resolution (zod-validated)
  http/
    router.ts           // Hono: REST routes
    ws.ts               // WS upgrade, session registry, event fan-out, backpressure
    staticFiles.ts      // /files/* → artifact dir (sendfile, ETag, range)
  db/
    db.ts               // node:sqlite open, WAL, pragmas, tx helper
    migrations/         // 0001_init.sql ... applied at boot (DATA_SCHEMA §6)
    repo/*.ts           // typed repositories, one per table group
  harness/
    orchestrator.ts     // the agent state machine (LLM_HARNESS §6)
    anthropic.ts        // Messages API client wrapper: stream, tools, retries
    tools/*.ts          // one module per tool: schema (zod) + executor
    validate.ts         // validation ladder evaluators
    prompts/*.ts        // verbatim prompt builders (string templates, tested)
  engine/
    client.ts           // ndjson JSON-RPC client over child stdio
    supervisor.ts       // spawn, heartbeat, backoff restart, orphan-run repair
  domain/
    events.ts           // zod schemas for ALL WS events (single source of truth)
    ids.ts              // ulid()
    result.ts           // Result<T,E> helpers
  log.ts                // structured ndjson logs → ~/PicoForge/logs/server.log
```

### 3.2 HTTP API (REST, JSON)

| Method & path | Purpose |
|---|---|
| `GET /api/health` | `{ok, engine:{status,pid,version}, db:ok, gpuHintsCached}` |
| `GET/POST /api/projects` · `GET/PATCH/DELETE /api/projects/:id` | Project CRUD |
| `GET/POST /api/projects/:id/conversations` | Conversation CRUD |
| `GET /api/conversations/:id/messages?after=` | Paged history hydrate |
| `POST /api/conversations/:id/cancel` | Cancel active run (also available over WS) |
| `GET /api/artifacts/:id` | Artifact metadata; binary at `/files/...` |
| `POST /api/artifacts/:id/export` | Re-export to another format (engine convert job) |
| `GET/PUT /api/settings` | Settings (API key write-only: accepted, stored to keyfile, never echoed) |
| `POST /api/selftest` | Full-pipeline cube test; used by first-run wizard |

All handlers: zod-parse input → repo/tx → typed response. Errors: `{error:{code, message, hint?}}` with correct 4xx/5xx; never a stack trace to the client (stack goes to log with the same `errId` echoed to the client for support).

### 3.3 WebSocket protocol (`/ws?conversationId=`)

One socket per open conversation tab. Every frame is JSON `{type, ...}` validated by `domain/events.ts` on **both** sides.

**Client → server**

```
user.message        { text, attachments?: [{artifactId}] }
run.cancel          { runId }
viewport.capture.result { requestId, pngBase64 | error }
ping                {}
```

**Server → client**

```
hello               { sessionId, resumeFrom: lastEventSeq }
chat.delta          { messageId, textDelta }
chat.block          { messageId, block }          // structured blocks: brief, note
chat.done           { messageId, usage }
run.status          { runId, state, attempt, stage }   // state ∈ RunState (see §7)
step.start          { runId, stepId, tool, title }
step.log            { runId, stepId, line }            // compiler/build/engine logs
step.done           { runId, stepId, ok, summaryJson }
geometry.ready      { runId, artifactId, url, format:"glb"|"stl",
                      stats:{volumeCm3,bbox,triangles,watertight,voxelSizeMm} }
viewport.capture.request { requestId, view:"iso"|"front"|"top"|"current", width,height }
error               { errId, code, message, recoverable }
pong                {}
```

Rules: monotonically increasing `seq` on every server frame; client reconnects with `?resume=<seq>` and the server replays from an in-memory ring buffer (last 500 events per conversation) — beyond that, client re-hydrates via REST. Send-queue watermark 1 MiB per socket; above it, `step.log` frames are dropped (they are also persisted, so nothing is lost) while all other types are always delivered.

### 3.4 Settings & secrets

`ANTHROPIC_API_KEY` lives in `~/PicoForge/secret.env` (chmod 600) or process env — **never** in SQLite, never logged, never echoed by the API. Model id, temperature, max attempts, voxel caps, telemetry-off — in `settings` table with zod-validated defaults.

---

## 4. Engine host (`/engine`, .NET 9, C#)

### 4.1 Projects

```
engine/
  ForgeEngine/            // host console app (managed only, no PicoGK reference)
    Program.cs            // stdio loop, dispatch, supervision of children
    Rpc.cs                // ndjson framing, request/response/notification types
    Compiler.cs           // Roslyn: parse → analyzers → emit DLL bytes (in-memory)
    Analyzers.cs          // banned-symbol walker (LLM_HARNESS §4.4)
    SandboxPool.cs        // prewarm 1 spare child; spawn/kill/monitor (RSS poll 250ms)
    SymbolTable.cs        // loads picogk_api.json produced at build time
  ForgeSandbox/           // child console app — the ONLY project referencing PicoGK
    Program.cs            // args: --job <path>; loads DLL, runs headless, exports
    Runner.cs             // Library lifecycle (headless), guards, export STL+GLB+VDB
    Kit/                  // PicoForge.Kit — golden helpers (PICOGK_KNOWLEDGE §4)
    Kit.Tests/            // golden-volume unit tests
  tools/DumpApi/          // reflection walker: PicoGK.dll + Kit.dll → picogk_api.json
```

`ForgeSandbox.csproj`: `<PackageReference Include="PicoGK" Version="2.2.*"/>` (PicoGK ships via NuGet since v1.7.7.5; native runtime binaries come with the package). `DumpApi` runs in `deno task setup` and regenerates `picogk_api.json` — the authoritative symbol whitelist consumed by both the Roslyn analyzer and the LLM prompt. **This closes the loop between "what the model is told exists" and "what actually compiles", for any future PicoGK version.**

### 4.2 JSON-RPC over stdio (ndjson, one JSON object per line)

Host methods (Deno → engine):

| Method | Params | Result |
|---|---|---|
| `engine.hello` | `{}` | `{version, picogkVersion, dotnet, symbolTableHash}` |
| `engine.compile` | `{code, codeId}` | `{ok, diagnostics:[{id,severity,line,col,message}], dllCached:bool}` |
| `engine.run` | `{codeId?, code?, params, limits:{timeoutS, maxRssMiB, maxCells}, exports:["stl","glb","vdb"], outDir}` | final `{ok, stats, files:{stl,glb,vdb,report}, log[] }` or typed error (§7) |
| `engine.inspect` | `{vdbPath | stlPath, ops:[...]}` | measurements (+ optional slice PNG paths) |
| `engine.convert` | `{src, format}` | `{file}` |
| `engine.cancel` | `{runId}` | `{ok}` (kills child) |
| `engine.ping` | `{}` | `{ok, rssMiB, children}` |

Notifications (engine → Deno) during `engine.run`: `run.log {runId,line}`, `run.progress {runId,frac}` (wired from PicoGK's `IProgress`/`ILog` interfaces into the job pipe).

### 4.3 Run execution sequence

1. Host compiles (or fetches DLL from LRU cache keyed by code hash).
2. Host writes a **job file** (`job.json`: dll path, params, limits, exports, outDir) into the run dir.
3. Host hands the job to the prewarmed sandbox child via its stdin; immediately forks a replacement spare.
4. Child: instantiate scoped PicoGK `Library` at `voxelSizeMm` in **headless** mode (headless supported since PicoGK v1.6; v2 supports non-global scoped `Library` instances — DumpApi verifies the exact signature and Runner.cs adapts at compile time). Load DLL → reflect `Design.voxBuild(Ctx)` → invoke inside try/catch → receive `Voxels`.
5. Child computes stats (`CalculateProperties` volume+bbox, `bIsEmpty`, triangle count after meshing, watertightness check), meshes (`mshAsMesh`), writes binary STL, GLB (via SharpGLTF, with vertex normals), VDB (via PicoGK `VdbFile`), and `report.json`.
6. Child exits 0. Host relays result. Any other exit path → typed error (§7).

**Guards enforced by the host while the child runs:** wall-clock timeout (SIGKILL), RSS poll > `maxRssMiB` (default 8192) → kill, stdout log line cap 5 000 (truncate marker), pre-flight cell estimate `Π ceil(bboxAxis/voxelSize)` from the design brief must be < `maxCells` (default 1.5e9; warn at 2.5e8 with an automatic voxel-size suggestion — see LLM_HARNESS §5.2).

### 4.4 Supervisor (Deno side)

Heartbeat `engine.ping` every 5 s. Missed 2 → mark degraded; missed 4 or process exit → restart with backoff 0.5 s→1→2→4→8 (cap), max 5 restarts / 10 min then surface a persistent UI banner with the log path. On restart: any run rows in state `running` become `failed{code:"ENGINE_LOST"}` and the harness turns that into a repair/apology turn — **an orphaned run is a normal, handled event, not an exception.**

---

## 5. Frontend (`/app`) — structural summary (details in UIUX.md / RENDERING.md)

```
app/
  src/
    main.tsx, App.tsx
    state/            // zustand stores: session, chat, runs, viewport, settings
    ws/client.ts      // reconnecting socket, seq-resume, zod-validated inbound
    chat/             // MessageList, Composer, BuildCard, BriefCard, ErrorCard
    viewport/
      ViewportEngine.ts   // imperative three.js class (RENDERING.md) — no React inside
      ViewportHost.tsx    // mounts engine, resize observer, HUD overlay portal
      hud/                // ViewCube, DRO readout, toolbar, render-mode badge
    panels/           // ProjectRail, SettingsDialog, FirstRunWizard, ConsoleDrawer
    styles/tokens.css // the design system (UIUX §2) — single source of visual truth
```

React never touches WebGL per-frame state; it passes commands to `ViewportEngine` (load, frame, setView, setSection, capture) and subscribes to a tiny status struct (fps, spp, mode) at 4 Hz for the HUD.

---

## 6. Failure model (exhaustive)

| # | Failure | Detector | Containment | Recovery | User sees |
|---|---|---|---|---|---|
| F1 | Generated code doesn't compile | Roslyn diagnostics | never executed | repair loop ≤3 (LLM_HARNESS §7) | Build card: "fixing a compile error (1/3)" |
| F2 | Runtime exception in build | try/catch in child | child only | repair loop ≤2 with exception + last 30 log lines | same pattern |
| F3 | Native crash / OOM / infinite loop | exit code, RSS poll, timeout | **child killed**, host fine | typed `SANDBOX_CRASH|OOM|TIMEOUT` → repair with resource hint (e.g. "increase voxel size") | card explains in plain language |
| F4 | Geometry invalid (empty, leaky, paper-thin, envelope blown) | validation ladder | n/a | repair ≤2 with measured numbers | card shows failed check + numbers |
| F5 | Engine host dies | supervisor heartbeat | restart w/ backoff | orphan runs → failed; auto-retry once if a run was queued | toast + card |
| F6 | Anthropic API error / rate limit / overload | SDK error, HTTP 429/5xx | n/a | retry 3× exp backoff + jitter on retryable codes; else surface | "model unavailable, retrying…" |
| F7 | WS drop | close event | client buffers input | auto-reconnect + seq resume | 1-line status chip |
| F8 | SQLite busy/corrupt | error codes | WAL + busy_timeout 5000 | busy → retry tx 3×; corrupt → boot-time integrity_check, quarantine db + start fresh (artifacts on disk survive) | wizard explains recovery |
| F9 | GPU context lost | `webglcontextlost` | viewport only | re-init engine, reload last artifact, drop to lower GPU tier | 1.5 s "restoring viewport" veil |
| F10 | Path tracer unsupported/too slow | tier probe / spp-rate watchdog | raster continues | disable studio mode for session | badge shows "RT off" |
| F11 | Disk full | write errors | run fails cleanly | typed `DISK_FULL`, retention GC offered | actionable dialog |
| F12 | Bad/expired API key | 401 | n/a | settings dialog focus | inline key prompt |

Rule: **every** `throw` in the codebase must map to exactly one row of this table or be added to it. Unknown errors crash loudly in dev (`deno task dev` runs with fail-fast) and map to F-generic with `errId` in prod.

## 7. Run state machine (persisted in `runs.state`)

```
queued → briefing → codegen → compiling → executing → validating → rendering → done
   │        │          │          │           │            │           
   └────────┴──────────┴──────────┴───────────┴────────────┴──► failed(code) 
                       ▲__________repair loop (bounded)_____│
any state ──user cancel──► cancelled
```

Legal transitions are encoded in one table in `orchestrator.ts`; illegal transition = programmer error = test failure. `attempt` increments only on repair re-entry to `codegen`.

---

## 8. Performance budgets (release gate — measured by `deno task bench`)

| Metric | Budget |
|---|---|
| Cold app start → interactive UI | < 2.5 s |
| Engine host cold start → `engine.hello` | < 1.5 s |
| Compile (typical 300-line design) | < 400 ms warm |
| Cube self-test end-to-end | < 6 s |
| "Fan impeller" prompt → geometry in viewport (excl. LLM tokens) | < 15 s compile+run+mesh+load |
| Viewport load 1 M-triangle STL → first frame | < 1.2 s (decimate for display > 1.5 M tris) |
| Raster interaction | 60 fps @ tier-A GPU, 30 fps floor tier-C (auto res scale) |
| Path trace to "clean" (≈256 spp @ 1080p) | < 20 s on RTX-3060-class; auto tile/scale below |
| Server idle RSS | < 180 MiB; engine host < 250 MiB idle |

---

## 9. Filesystem layout (user machine)

```
~/PicoForge/                     (Windows: %USERPROFILE%\PicoForge)
  picoforge.db                   SQLite (WAL: -wal, -shm alongside)
  secret.env                     ANTHROPIC_API_KEY=...   (0600)
  logs/ server.log engine.log
  kb/                            ingested docs (PICOGK_KNOWLEDGE + fetched PicoGK docs)
  projects/<projectId>/
    runs/<runId>/  code.cs job.json build.log report.json
                   part.stl part.glb part.vdb capture_iso.png
    exports/       user-named exports
  tmp/                           cleaned at boot
```

Retention: `runs/` GC keeps last 25 runs per project or 2 GiB (configurable); artifacts referenced by pinned messages are never GC'd (DATA_SCHEMA §7).

---

## 10. Security posture (local app, still disciplined)

Server binds `127.0.0.1` only. WS/REST require the `X-PicoForge-Token` printed to the desktop window at boot (defeats drive-by localhost attacks from other browser tabs). Generated code: static analyzer bans (namespaces `System.IO`, `System.Net`, `System.Reflection.Emit`, `System.Diagnostics`, `System.Threading` except `Interlocked`, `unsafe`, `DllImport`, `Environment`, `AppDomain`, `GC.` mutation) + child runs with cwd=run dir and no inherited env secrets. Deno itself runs with explicit permissions: `--allow-net=127.0.0.1:7317,api.anthropic.com --allow-read/write=~/PicoForge,<repo> --allow-run=dotnet,<engine binary>`.

## 11. Packaging & modes

* **Dev:** `deno task dev` = engine watch-build + server (`deno run --watch`) + Vite HMR + auto-open window.
* **Prod:** `deno task build` → Vite build to `server/public/`, `dotnet publish -c Release` engine, `deno compile` server → single `picoforged` binary. Launcher opens the desktop window via Deno's desktop app support (`deno desktop`, per https://docs.deno.com/runtime/desktop/ — verify current API) with fallback `chrome/msedge --app=http://127.0.0.1:7317?t=<token>`.
* **Self-test:** `picoforged --selftest` runs the cube pipeline headless and exits 0/1 — used as the installer's final step and as the CI smoke test.
