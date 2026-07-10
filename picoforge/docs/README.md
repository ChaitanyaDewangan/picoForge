# PICOFORGE — Chat-to-Part Computational Engineering Studio

> **One sentence:** A local desktop web app where you tell an AI agent *"build a turbine for my fan"* and it designs the part using real mechanical-engineering math, writes PicoGK (C#) code, compiles and runs it in a sandbox, validates the geometry, and streams the result into a Fusion-360-style ray-traced 3D viewport — all on your own machine.

**Codename:** `PicoForge` (rename freely — grep for `picoforge` when you do)
**Status:** Specification pack v1.0 — ready for implementation by a human or an LLM coding agent.

---

## 1. What this document pack is

This folder is a **complete, self-sufficient build specification**. It is written so that a reasonably good LLM coding agent (Claude Code, etc.) — or a human SDE — can implement the entire application without inventing architecture on the fly. Every file is normative: when two interpretations are possible, the spec's wording wins.

| File | What it specifies | Read when |
|---|---|---|
| `README.md` | This overview, quickstart, glossary, invariants | First |
| `AGENTS.md` | **The build playbook.** Milestones M0–M8, per-function specs, acceptance gates, the "no crashes" engineering doctrine. This is the prompt for the implementing agent. | Second — then keep open forever |
| `SYS_DESIGN.md` | Three-process architecture, IPC protocols, resource guards, failure model, directory layout, packaging | Before writing any code |
| `DATA_SCHEMA.md` | Full SQLite DDL, filesystem layout, migrations, retention | Milestone M3 |
| `LLM_HARNESS.md` | **The AI core.** Verbatim system prompts, tool JSON schemas, the agent state machine, the validation ladder that makes failure nearly impossible | Milestone M2 |
| `PICOGK_KNOWLEDGE.md` | PicoGK v2.2 API card, the `PicoForge.Kit` golden-helper library, engineering recipes (turbine, bracket, heat exchanger...), physics formula pack, materials table | Milestone M1 + injected into the LLM at runtime |
| `UIUX.md` | Design system (tokens, type, motion), every screen, every component, keyboard map | Milestone M4 |
| `RENDERING.md` | The 3D viewport: raster pipeline + progressive path tracing, studio lighting, camera model, GPU tiering | Milestone M5/M7 |
| `USER_FLOWS.md` | Numbered end-to-end flows including every failure branch | Alongside everything |
| `MCP_SERVER_GUIDE.md` | Guide to build the mcp Server | When Build Everyhting |

---

## 2. The product in 30 seconds

```
┌────────────────────────────┬──────────────────────────────────────┐
│  CHAT (40%)                │  VIEWPORT (60%)                      │
│                            │                                      │
│  You: build a 120mm quiet  │        ╭─────────────╮   ┌─ViewCube─┐│
│  desktop fan impeller,     │       ╱   turbine     ╲  │ T  F  R  ││
│  PETG, 1800 rpm            │      │   (ray-traced,  │ └──────────┘│
│                            │       ╲  studio light)╱              │
│  Agent: [Design Brief]     │        ╰─────────────╯               │
│   ▸ 7 blades, free-vortex  │   ──────── ground / grid ────────    │
│   ▸ tip speed 11.3 m/s ✓   │                                      │
│  [Build ▮▮▮▮▮░░ compiling] │  VOL 42.7 cm³  ⌀120.0  H 24.0  ✓WT  │
│  [Geometry ready → viewport]│  ORTHO · ISO · 512 spp · RTX ON     │
└────────────────────────────┴──────────────────────────────────────┘
```

1. User types an engineering request in plain language.
2. The **harness** (Deno/TypeScript orchestrator) drives Claude through a fixed pipeline: *design brief → PicoGK C# code → compile → run → validate → render*.
3. The **engine** (a supervised .NET 9 process) compiles the generated code with Roslyn in ~200 ms, executes it headless inside a crash-isolated sandbox child, and emits a mesh (STL/GLB) + geometry statistics.
4. The **viewport** (three.js) loads the mesh instantly with a rasterized studio look, then — the moment the camera goes idle — progressively refines it with a GPU path tracer for a photoreal "showcase" render.
5. Everything (chats, code versions, artifacts, stats, logs) is persisted in a local SQLite database. No cloud except the Anthropic API call itself.

---

## 3. Non-negotiable invariants (the whole pack enforces these)

1. **The host never dies.** Generated C# code runs only in a disposable sandbox child process. A segfault in native OpenVDB code kills the child, never the engine host, never the Deno server. (SYS_DESIGN §6)
2. **The model never touches the filesystem, network, or process APIs.** Generated code implements exactly one pure function: `Voxels Design.voxBuild(Ctx ctx)`. Export, logging, and lifecycle belong to the harness. (LLM_HARNESS §4)
3. **Every model output is validated before the user sees it as truth.** Static lint → compile → runtime guards → geometry validation ladder → only then "geometry ready". Each failure type feeds a structured repair prompt with a bounded retry budget. (LLM_HARNESS §7)
4. **Physics before geometry.** The agent must submit a machine-checked design brief (dimensions, formulas, safety factors) before it is allowed to emit code. (LLM_HARNESS §5.2)
5. **Interaction beats fidelity.** The viewport never drops below interactive framerates to chase ray-traced quality; path tracing only runs when the camera is idle. (RENDERING §5)
6. **Local-first.** SQLite + files under `~/PicoForge/`. Deleting that folder is a complete uninstall of user data. (DATA_SCHEMA §2)
7. **Every boundary is typed and validated.** Zod on every WS/HTTP message, JSON Schema on every tool call, exhaustive `switch` on every enum. `any` is banned. (AGENTS §3)

---

## 4. Technology decisions (locked)

| Layer | Choice | Why |
|---|---|---|
| Runtime / server | **Deno 2.x** (TypeScript, `Deno.serve` + Hono router) | User-mandated; TS-first, single toolchain (`deno task`, `deno test`, `deno compile`), secure-by-default permissions |
| Frontend | **React 19 + Vite**, **Base UI** (`@base-ui-components/react`) unstyled primitives, hand-written CSS design tokens | User asked for Base UI; unstyled primitives fit the custom dark instrument-panel aesthetic in UIUX.md |
| 3D | **three.js** (imperative `ViewportEngine` class), `camera-controls`, `three-gpu-pathtracer` for progressive ray tracing, STL/GLB loaders, meshoptimizer for display decimation | Proven on consumer GPUs; WebGL2 baseline, WebGPU behind a flag |
| Geometry kernel | **PicoGK v2.2** (NuGet package `PicoGK`), headless mode, OpenVDB 13 under the hood | The whole point; v2.x has scoped `Library` instances, `Voxels` operators, slice extraction, memory reporting |
| Codegen sandbox | **.NET 9** host+child processes, **Roslyn** in-memory compilation, ndjson JSON-RPC over stdio | Sub-second compile loops; crash isolation |
| LLM | **Anthropic Messages API**, default model `claude-sonnet-4-6` (configurable), native tool use, streaming | Verify current model IDs & tool-use format at https://docs.claude.com/en/api/overview before release |
| DB | **SQLite** via `node:sqlite` (Deno ≥2.2), WAL mode; FTS5 for the local docs index (fallback driver `jsr:@db/sqlite` if FTS5 missing) | Zero-dependency local persistence |
| Packaging | `deno task dev` for development; ship as `deno compile` binary + `dotnet publish` engine; window via Deno's desktop support (`deno desktop`, see https://docs.deno.com/runtime/desktop/) or Chromium `--app=` fallback | "Desktop web application" with one installer |

---

## 5. Quickstart (once implemented)

```sh
# Prerequisites
deno --version        # >= 2.2
dotnet --version      # >= 9.0 SDK
# GPU: anything with WebGL2. Path tracing auto-scales; RTX-class cards get full quality.

git clone <repo> picoforge && cd picoforge
cp .env.example .env               # put ANTHROPIC_API_KEY here (never in the DB)
deno task setup                    # dotnet restore (pulls PicoGK 2.2 from NuGet),
                                   # builds engine, generates PicoGK symbol table,
                                   # ingests docs into SQLite FTS
deno task dev                      # server :7317 + Vite HMR, opens the app window
deno task check                    # fmt + lint + typecheck + all tests (CI gate)
```

First run walks the user through: API key → engine self-test (compiles & runs a 10 mm cube through the full pipeline) → GPU benchmark → ready.

---

## 6. Glossary

| Term | Meaning |
|---|---|
| **Harness** | The Deno-side orchestrator that owns the conversation with Claude, executes tool calls, enforces the validation ladder and retry budgets |
| **Engine** | The long-lived .NET host process (`forge-engine`) that compiles code and supervises sandbox children |
| **Sandbox** | A disposable child process that loads PicoGK's native runtime and executes one build; killed on timeout/OOM/crash |
| **Ctx** | `PicoForge.Kit.Ctx` — the only object generated code receives; carries voxel size, parameters, material, logger, progress |
| **Kit** | `PicoForge.Kit` — vetted helper library (lofts, patterns, shells, airfoils) compiled into the engine; the model composes helpers instead of reinventing meshing math |
| **Design brief** | Structured, machine-validated engineering parameters + physics checks the model must submit before coding |
| **Validation ladder** | lint → compile → run-guards → geometry checks; every rung has a typed error and a repair path |
| **Artifact** | Any persisted output: mesh file, VDB, code version, capture PNG, report |
| **Build card** | The chat UI element that shows a run's live pipeline state (the app's signature component) |
| **Studio mode** | Idle-camera progressive path tracing state of the viewport |

---

## 7. Scope fences for v1

**In:** single user, single machine, one build running at a time per project, mm units, single-body outputs (multi-body via boolean union), STL/3MF/GLB/VDB export, English UI.
**Out (extension points documented, not built):** assemblies with joints, FEA integration (ScalarField hooks exist), cloud sync, multi-user, local LLMs (the provider interface is pluggable), printing slicer integration beyond CLI export.

Start with `AGENTS.md`. Build in milestone order. Do not skip gates.
