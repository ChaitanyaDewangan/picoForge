# Graph Report - picoforge  (2026-07-10)

## Corpus Check
- 49 files · ~34,128 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 604 nodes · 790 edges · 32 communities (31 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4edf1f8a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Kit
- M0 Complete ✅
- client.ts
- Compiler
- tasks
- log.ts
- SandboxPool
- package.json
- LLM_HARNESS.md — The Agent Core
- events.ts
- compilerOptions
- SYS_DESIGN.md — PicoForge System Architecture
- Kit.Tests
- compilerOptions
- USER_FLOWS.md — End-to-End Flows (with failure branches)
- KitGoldenTests
- The GitHub Repo Role
- MCP_SERVER.md — PicoForge as an MCP Server ("Bring Your Own Model" Mode)
- Runner.cs
- AGENTS.md — PicoForge Build Playbook
- App.tsx
- PICOGK_KNOWLEDGE.md — Kernel API, Kit Helpers, Recipes, Physics
- DATA_SCHEMA.md — Local Persistence
- RENDERING.md — Viewport & Ray-Traced Showcase Pipeline
- PICOFORGE — Chat-to-Part Computational Engineering Studio
- UIUX.md — Design System & Interface Specification
- PicoForge Build Log
- Params
- Program.cs
- tsconfig.json

## God Nodes (most connected - your core abstractions)
1. `Kit` - 27 edges
2. `Ctx` - 23 edges
3. `compilerOptions` - 19 edges
4. `M0 Complete ✅` - 19 edges
5. `KitGoldenTests` - 16 edges
6. `PicoForge — What I Understood` - 16 edges
7. `USER_FLOWS.md — End-to-End Flows (with failure branches)` - 16 edges
8. `compilerOptions` - 15 edges
9. `The GitHub Repo Role` - 15 edges
10. `EngineClient` - 14 edges

## Surprising Connections (you probably didn't know these)
- `buildRouter()` --references--> `hono`  [EXTRACTED]
  server/http/router.ts → deno.json
- `BannedSymbolAnalyzer` --references--> `Diagnostic`  [EXTRACTED]
  engine/ForgeEngine/Analyzers.cs → engine/ForgeEngine/Compiler.cs
- `BannedSymbolAnalyzer` --references--> `SymbolTable`  [EXTRACTED]
  engine/ForgeEngine/Analyzers.cs → engine/ForgeEngine/SymbolTable.cs
- `main()` --calls--> `loadConfig()`  [EXTRACTED]
  server/main.ts → server/config.ts
- `main()` --calls--> `openDb()`  [EXTRACTED]
  server/main.ts → server/db/db.ts

## Import Cycles
- None detected.

## Communities (32 total, 1 thin omitted)

### Community 0 - "Kit"
Cohesion: 0.10
Nodes (19): BBox3, PicoForge.Kit, Kit.Tests, Action, Ctx, Material, Rng, IReadOnlyList (+11 more)

### Community 1 - "M0 Complete ✅"
Cohesion: 0.04
Nodes (45): Chat Conversation, Current State of the Workspace, Files created (24 total), ForgeEngine (C# — managed-only host), ForgeSandbox (C# — only project, How PicoGK is Used, M0 Complete ✅, M1 Engine — Complete ✅ (+37 more)

### Community 2 - "client.ts"
Cohesion: 0.08
Nodes (15): err, ok, Result, EngineClient, EngineCompileResult, EngineHelloResult, EnginePingResult, EngineRunParams (+7 more)

### Community 3 - "Compiler"
Cohesion: 0.07
Nodes (23): AttributeSyntax, ConcurrentDictionary, CSharpSyntaxWalker, HashSet, List, BannedSymbolAnalyzer, HashSet, IReadOnlyList (+15 more)

### Community 4 - "tasks"
Cohesion: 0.05
Nodes (37): compilerOptions, lib, noFallthroughCasesInSwitch, noImplicitAny, noUnusedLocals, noUnusedParameters, strict, strictNullChecks (+29 more)

### Community 5 - "log.ts"
Cohesion: 0.11
Nodes (28): log, main(), ROOT, run(), step(), Config, ConfigSchema, loadApiKey() (+20 more)

### Community 6 - "SandboxPool"
Cohesion: 0.09
Nodes (16): bool, CancellationToken, ForgeEngine, Lock, RpcRequest, RpcWriter, Action, Lock (+8 more)

### Community 7 - "package.json"
Cohesion: 0.08
Nodes (23): dependencies, @base-ui/react, camera-controls, react, react-dom, three, three-gpu-pathtracer, devDependencies (+15 more)

### Community 8 - "LLM_HARNESS.md — The Agent Core"
Cohesion: 0.08
Nodes (23): 10. Multi-turn edits ("make the blades thicker"), 11. Harness test suite (must exist before UI work — AGENTS M2), 1. Why this design is hard to fail (the eight load-bearing decisions), 2. Components, 3. SYSTEM PROMPT (verbatim template), 4.1 Structural check (regex + Roslyn syntax tree), 4.2 Banned-symbol analyzer (engine `Analyzers.cs`), 4.3 Unknown-symbol pre-pass (+15 more)

### Community 9 - "events.ts"
Cohesion: 0.08
Nodes (22): ChatBlockEvent, ChatDeltaEvent, ChatDoneEvent, ClientEvent, ClientEventSchema, ErrorEvent, GeometryReadyEvent, GeometryStats (+14 more)

### Community 10 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+12 more)

### Community 11 - "SYS_DESIGN.md — PicoForge System Architecture"
Cohesion: 0.10
Nodes (20): 10. Security posture (local app, still disciplined), 11. Packaging & modes, 1. Design goals → architectural consequences, 2. Process topology, 3.1 Module map, 3.2 HTTP API (REST, JSON), 3.3 WebSocket protocol (`/ws?conversationId=`), 3.4 Settings & secrets (+12 more)

### Community 12 - "Kit.Tests"
Cohesion: 0.12
Nodes (16): ForgeEngine, net9.0, Microsoft.NET.Sdk, net9.0, Microsoft.NET.Sdk, Kit.Tests, net9.0, Microsoft.NET.Sdk (+8 more)

### Community 13 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+8 more)

### Community 14 - "USER_FLOWS.md — End-to-End Flows (with failure branches)"
Cohesion: 0.12
Nodes (16): F0 · First run, F10 · Engine dies mid-run, F11 · API unreachable / 429, F12 · Reload / resume, F13 · Inspect & section, F14 · Showcase render, F1 · Create project, F2 · "Build a turbine for my fan" — the golden path (full trace) (+8 more)

### Community 15 - "KitGoldenTests"
Cohesion: 0.34
Nodes (4): KitGoldenTests, Fact, float, Func

### Community 16 - "The GitHub Repo Role"
Cohesion: 0.13
Nodes (15): Planner Response, Planner Response, Planner Response, Planner Response, Planner Response, Planner Response, Planner Response, Planner Response (+7 more)

### Community 17 - "MCP_SERVER.md — PicoForge as an MCP Server ("Bring Your Own Model" Mode)"
Cohesion: 0.13
Nodes (14): 10. Acceptance gate (M9), 1. Concept, 2. Architecture, 3. Sessions, 4.1 Tools (names and schemas are the LLM_HARNESS §5 schemas, verbatim), 4.2 Resources (read-only; URIs stable), 4.3 Prompts, 4. Exposed surface (+6 more)

### Community 18 - "Runner.cs"
Cohesion: 0.19
Nodes (8): ForgeSandbox, Dictionary, Voxels, JobSpec, LimitsSpec, ReportStats, Runner, JsonElement

### Community 19 - "AGENTS.md — PicoForge Build Playbook"
Cohesion: 0.18
Nodes (10): 0. Prime directive, 1. PONYTAIL — how you write code here (active: `full`), 2. GRAPHIFY — how you navigate and remember here, 3. Engineering doctrine — the "no crashes" law, 4. Milestones (build in order; a gate failing blocks the next milestone), 5. Testing strategy (summary — details live per milestone), 6. Risk register (check when entering the related milestone), 7. Definition of done (the whole project) (+2 more)

### Community 20 - "App.tsx"
Cohesion: 0.20
Nodes (3): App(), DotStatus, root

### Community 21 - "PICOGK_KNOWLEDGE.md — Kernel API, Kit Helpers, Recipes, Physics"
Cohesion: 0.18
Nodes (10): 1. [KB] PicoGK mental model, 2. [KB] Coordinate & authoring conventions (enforced by validators), 3. PicoGK API card (compressed form the model sees — generated, this is the template), 4. `PicoForge.Kit` — the golden helper library (implement in M1, this is the contract), 5. [KB] Physics formula pack (the agent's checkable math), 6. [KB] Recipe: axial fan impeller (canonical, ships as `recipes/rotor_fan`), 7. [KB] Recipe stubs (each ~1 page in KB with formulas + Kit composition), 8. Materials table (Kit `Material` presets; brief validator source of truth) (+2 more)

### Community 22 - "DATA_SCHEMA.md — Local Persistence"
Cohesion: 0.20
Nodes (9): 1. Engine & pragmas, 2. Entity relationship overview, 3. DDL, 4. Query patterns the schema must serve fast (verify with EXPLAIN in tests), 5. Transactions, 6. Migrations, 7. Retention / GC, 8. Backup story (+1 more)

### Community 23 - "RENDERING.md — Viewport & Ray-Traced Showcase Pipeline"
Cohesion: 0.20
Nodes (9): 1. ViewportEngine public API (the whole surface React may touch), 2. Geometry ingest, 3. Scene & studio lighting (the "showcase" look), 4. Camera model (Fusion-360 feel, ortho default), 5. Two-path rendering & the mode ladder, 6. GPU tiering (probe at first run, stored in settings, degradable at runtime), 7. Capture service (feeds the `capture_viewport` tool and user exports), 8. Performance & memory budget (+1 more)

### Community 24 - "PICOFORGE — Chat-to-Part Computational Engineering Studio"
Cohesion: 0.22
Nodes (8): 1. What this document pack is, 2. The product in 30 seconds, 3. Non-negotiable invariants (the whole pack enforces these), 4. Technology decisions (locked), 5. Quickstart (once implemented), 6. Glossary, 7. Scope fences for v1, PICOFORGE — Chat-to-Part Computational Engineering Studio

### Community 25 - "UIUX.md — Design System & Interface Specification"
Cohesion: 0.22
Nodes (8): 1. Layout — the split, 2. Design tokens (`app/src/styles/tokens.css` — single source of visual truth), 3. Components (Base UI mapping + custom), 4. Viewport interaction spec (feel = Fusion 360; engine details in RENDERING.md), 5. Global keyboard map, 6. First-run wizard (Dialog, 3 steps, mono checklist aesthetic), 7. Copy rules, UIUX.md — Design System & Interface Specification

### Community 26 - "PicoForge Build Log"
Cohesion: 0.29
Nodes (6): 10/07/2026 09:24 AM, 10/07/2026 09:25 AM, 10/07/2026 09:26 AM, 10/07/2026 09:42 AM → M1 ENGINE IN PROGRESS, 10/07/2026 09:57 AM → M0 SCAFFOLD COMPLETE, PicoForge Build Log

### Community 27 - "Params"
Cohesion: 0.29
Nodes (3): Dictionary, Vector3, Params

### Community 28 - "Program.cs"
Cohesion: 0.83
Nodes (3): ApiManifest, ApiMember, ApiType

## Knowledge Gaps
- **316 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+311 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `KitGoldenTests` connect `KitGoldenTests` to `Kit`, `SandboxPool`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `ForgeEngine` connect `SandboxPool` to `Compiler`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _316 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Kit` be split into smaller, more focused modules?**
  _Cohesion score 0.09579100145137881 - nodes in this community are weakly interconnected._
- **Should `M0 Complete ✅` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `client.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07665505226480836 - nodes in this community are weakly interconnected._
- **Should `Compiler` be split into smaller, more focused modules?**
  _Cohesion score 0.06970128022759602 - nodes in this community are weakly interconnected._