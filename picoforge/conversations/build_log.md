# PicoForge Build Log

## 10/07/2026 09:24 AM

Read the repo and gave full project overview. PicoForge is a local desktop engineering studio:
- Chat request → AI designs part → PicoGK C# code → Roslyn compile → sandbox execution → ray-traced 3D viewport
- Three OS processes: Deno server + .NET engine host + disposable sandbox child
- LLM harness: deterministic state machine around Claude with 7 tools and bounded repair loops
- Tech stack: Deno 2.x + Hono, React 19 + Vite + Base UI, three.js + three-gpu-pathtracer, PicoGK 2.2 via NuGet, SQLite WAL

## 10/07/2026 09:25 AM

User asked for overview — explained the 3-process architecture, 8 "hard to fail" decisions, the build pipeline (brief → codegen → compile → execute → validate → render), and the 9 milestones.

## 10/07/2026 09:26 AM

User asked about PicoGK repo usage — confirmed: we use it as a NuGet package (`PicoGK 2.2.*`), not a cloned repo. DumpApi reflects over the installed DLL to auto-generate the API symbol table.

## 10/07/2026 09:57 AM → M0 SCAFFOLD COMPLETE

Built full M0 scaffold (24 files):
- deno.json with all tasks
- server/main.ts + config.ts + log.ts + http/router.ts (GET /api/health)
- server/domain/events.ts (all 17 WS event Zod schemas), ids.ts, result.ts
- server/db/db.ts (WAL + migrations + withTx) + 0001_init.sql (full DDL)
- app/index.html + package.json (React 19, @base-ui/react 1.x, three.js) + vite.config.ts
- app/src/styles/tokens.css (verbatim UIUX §2 design tokens)
- app/src/main.tsx + App.tsx (UIUX §1 split layout shell)
- engine/PicoForge.sln + 4 .NET project stubs
- scripts/setup.ts
Verified: npm install ✅ Vite running ✅ dark instrument-panel UI renders at localhost:5173

## 10/07/2026 09:42 AM → M1 ENGINE IN PROGRESS

User said "continue" — Deno and .NET still not installed. Building all M1 source files:
- ForgeEngine: Rpc.cs (ndjson framing), Compiler.cs (Roslyn + LRU cache + contract checks), Analyzers.cs (banned-symbol walker + FORGE001/002), SymbolTable.cs (Levenshtein fuzzy match), SandboxPool.cs (prewarm + RSS poll + timeout), Program.cs (full RPC loop)
- ForgeSandbox: Runner.cs (PicoGK headless Library.Go + Design.voxBuild + export), Program.cs
- Kit/Ctx.cs (Ctx, Params, Material table, Rng)
- Kit/Kit.cs (full PicoForge.Kit: all primitives, sweeps, loft, patterns, modifiers, NACA airfoil, voxAxialRotor)
- Kit.Tests golden-volume tests (sphere, cylinder, tube, extrudeZ, revolve, loft, rotor, NACA, Shell)
- DumpApi full reflection walker → picogk_api.json
- server/engine/client.ts (Deno-side RPC client)
- server/engine/supervisor.ts (heartbeat + backoff restart + orphan repair)
