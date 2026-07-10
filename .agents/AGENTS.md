# AGENTS.md — PicoForge Build Playbook

You are the implementing agent (Antigravity IDE, Claude Code, or equivalent). This file is your standing orders for building PicoForge from the spec pack in `KNOWLEDGE_BASE/`. It is loaded every session. Follow it exactly; when it conflicts with your instincts, it wins.

**The pack:** `KNOWLEDGE_BASE/README.md` (overview) · `KNOWLEDGE_BASE/SYS_DESIGN.md` (architecture) · `KNOWLEDGE_BASE/DATA_SCHEMA.md` (DB) · `KNOWLEDGE_BASE/LLM_HARNESS.md` (agent core) · `KNOWLEDGE_BASE/PICOGK_KNOWLEDGE.md` (kernel/Kit/physics) · `KNOWLEDGE_BASE/UIUX.md` (design system) · `KNOWLEDGE_BASE/RENDERING.md` (viewport) · `KNOWLEDGE_BASE/USER_FLOWS.md` (acceptance scripts). Section references like "SYS_DESIGN §6" point there. Read the referenced section *before* implementing, not after failing.

---

## 0. Prime directive

Ship a local desktop web app where a chat request like "build a turbine for my fan" becomes validated PicoGK geometry in a ray-traced viewport — **without the app ever crashing and without you ever guessing where the spec has already decided.** Two failure modes end a milestone review: (a) an unhandled error path not mapped to SYS_DESIGN §6, (b) architecture invented where the pack already specifies it.

---

## 1. PONYTAIL — how you write code here (active: `full`)

Ponytail (DietrichGebert/ponytail) is installed as an always-on rule in `.agents/rules/`. Its ladder governs every unit of code you write. Before writing, stop at the first rung that holds:

```
1. Does this need to exist?          → no: skip it (YAGNI)
2. Already in this codebase?         → reuse it, don't rewrite
3. Stdlib does it?                   → use it   (Deno std / .NET BCL / browser API)
4. Native platform feature?          → use it   (<dialog>, node:sqlite, Deno.serve…)
5. Installed dependency does it?     → use it   (Base UI, camera-controls, Hono…)
6. One line?                         → one line
7. Only then: the minimum that works
```

**Precedence rule (memorize this):** the spec pack outranks rung 1. If SYS_DESIGN/LLM_HARNESS mandates a structure (validation ladder, supervisor, typed WS events, sandbox child, DumpApi), it *needs to exist* — rung 1 is already answered yes by the spec. Ponytail then governs **how small** each mandated unit is, never **whether** it exists. Deleting a spec'd safety mechanism as "over-engineering" is a violation of both this file and ponytail's own never-cut list.

**Never on the chopping block** (ponytail's list + ours): trust-boundary validation (zod at WS/HTTP/tool boundaries), data-loss handling (SQLite transactions, WAL), security (banned-symbol analyzer, localhost token, key handling), accessibility (UIUX §5), and every failure handler in SYS_DESIGN §6.

**Cadence:**
- After every milestone's code is green: run `/ponytail-review` on the diff and act on the delete-list before the gate.
- End of M4 and M8: `/ponytail-audit` on the whole repo.
- Deferred simplifications you mark with `ponytail:` comments: harvest with `/ponytail-debt` at each milestone close — "later" items become tracked ledger entries, not fossils.
- Mode stays `full`. Use `ultra` only when refactoring a file the audit flagged; never `off`.

Concrete house examples: use `<dialog>`/Base UI primitives before writing a modal manager; `AbortController` before a cancellation framework; `Map` before a cache class; one `withTx(fn)` helper, not a repository base-class hierarchy; Kit helpers before new mesh math.

## 2. GRAPHIFY — how you navigate and remember here

Graphify (safishamsi/graphify, PyPI `graphifyy`) is installed with Antigravity integration (`.agents/rules` + `.agents/workflows`) and a git post-commit hook. The knowledge graph in `graphify-out/` is your map of this codebase — code (tree-sitter, local), the spec docs, and their cross-links in one graph.

Rules:
1. **Query before grep.** For any "where/what/how does X connect" question, run `graphify query "<question>"` (or `/graphify` skill) before opening files or searching text. `graphify path "A" "B"` for connection questions, `graphify explain "Symbol"` before modifying anything with more than two callers.
2. **Rebuild on structure change.** The post-commit hook re-extracts automatically (AST-only, free). After adding a new module/milestone, also run `/graphify . --update` so doc↔code links refresh; run `graphify export callflow-html` at each milestone close and skim it — architecture drift shows up there first.
3. **`graphify-out/` is committed** (except `cost.json`, gitignored). It ships with the repo so any future session starts with the map.
4. **Record outcomes.** When a graph query materially helped or misled you, log it: `graphify save-result --question "..." --answer "..." --outcome useful|dead_end|corrected`. At milestone close run `graphify reflect --if-stale` — the LESSONS.md it maintains is part of your context next session.
5. Respect `.graphifyignore` (build output, `.tools/`, `bin/obj` are excluded); never hand-edit `graph.json`.

## 3. Engineering doctrine — the "no crashes" law

1. **Every throw maps to SYS_DESIGN §6.** New failure discovered → add a row to the table (PR the doc) → then handle it. Unknown errors: fail-fast in dev, F-generic with `errId` in prod.
2. **Typed everything.** No `any`, no `as` casts to silence errors, no `@ts-ignore`. `Result<T,E>` for fallible ops in harness/engine-client; exceptions only at true boundaries with one handler.
3. **Validate at every boundary.** zod on all WS/HTTP/tool payloads inbound *and* outbound (`domain/events.ts` is the single source). Engine RPC frames validated both sides. C#: argument checks with actionable messages.
4. **Exhaustive switches** on every enum/union with `never` assertion. Adding a state that doesn't compile everywhere it matters is the point.
5. **No floating promises** (lint-enforced). Every `await` inside run-loops checks the cancel flag after.
6. **One transaction per user-visible state change** (DATA_SCHEMA §5). No nested tx.
7. **Processes are cattle.** Supervisor restarts engine (backoff, cap); sandbox children are disposable; boot repairs orphan runs before serving traffic. Never `process.exit` outside `main.ts`.
8. **Generated C# is hostile input.** It runs only in the sandbox child, only after analyzer + compile, only under limits. No exceptions to this, ever, including "just for testing".
9. **No TODO/FIXME/placeholder/mock left in a gated milestone.** Stub ≠ done. If something is deferred, it's a `ponytail:` ledger entry or a doc'd extension point.
10. **Logs are structured** (ndjson, `area`+`errId`), secrets never logged, log tail caps enforced.
11. **Verify external APIs at build time, not from memory:** Anthropic request/stream shapes against https://docs.claude.com/en/api/overview; PicoGK symbols via DumpApi; Deno desktop packaging against https://docs.deno.com/runtime/desktop/. If docs disagree with the spec pack, docs win for the API shape — note the delta in the PR.

## 4. Milestones (build in order; a gate failing blocks the next milestone)

Every milestone ends with: `deno task check` green (fmt+lint+typecheck+tests) · `/ponytail-review` applied · `/graphify . --update` + `graphify reflect --if-stale` · a runnable demo.

**M0 — Scaffold & CI.** `deno.json` tasks (dev/check/test/bench/setup/db:reset), strict TS config, lint rules (no-explicit-any, no-floating-promises), empty Hono server with `/api/health`, Vite+React shell rendering tokens.css, engine solution compiling empty. Gate: `deno task check` green in a clean clone; health returns `{ok:true}`.

**M1 — Engine + Kit.** ForgeEngine host (Rpc.cs ndjson framing, Compiler.cs Roslyn+cache, Analyzers.cs banned/unknown symbols, SandboxPool.cs), ForgeSandbox Runner (headless PicoGK lifecycle per PICOGK_KNOWLEDGE §1, guards, STL+GLB+VDB+report export), full `PicoForge.Kit` per PICOGK_KNOWLEDGE §4 with golden-volume tests, `tools/DumpApi` → `picogk_api.json`. Gate: `dotnet test` green incl. golden volumes; `echo '{"method":"engine.run",...cube...}' | forge-engine` produces a watertight STL in <6 s; kill -9 on a child mid-run leaves host answering `engine.ping`.

**M2 — Harness (headless).** `anthropic.ts` (stream, tools, F6 retries), all 7 tool modules with zod+JSON schemas exactly per LLM_HARNESS §5, brief validator (every rule unit-tested), orchestrator state machine, validation ladder, repair prompts, context windower, prompt renderers (<9 k tokens asserted). CLI runner `deno task harness:once "prompt"` against the real engine. Gate: full mock-model golden-transcript suite (LLM_HARNESS §11) green; live smoke: fan prompt → geometry stats printed, ≤1 repair.

**M3 — Server + DB.** Migrations 0001 (DATA_SCHEMA §3), repos with `withTx`, boot orphan-repair, REST routes, WS hub with seq/resume/backpressure, engine supervisor with heartbeat, kb ingest + FTS (§9 ranking tests), static `/files`. Gate: repo tests + EXPLAIN checks (§4); kill engine process during a run → run row `failed{ENGINE_LOST}` and `/api/health` shows recovery; WS resume replays missed frames.

**M4 — App shell + chat.** tokens.css verbatim from UIUX §2, layout split with resizable divider, WS client (reconnect+resume), chat store, MessageList/Composer, BuildCard/BriefCard/ErrorCard in all states (Storybook-style fixture page `/dev/cards`), console drawer, settings dialog, first-run wizard, ask_user option buttons. Gate: fixture page shows every card state pixel-matching UIUX; E2E (Playwright): send message → mocked-server events drive card through all stages.

**M5 — Viewport raster.** ViewportEngine per RENDERING §1–4: GLB/STL ingest+decimation, studio scene, ortho-default camera-controls, ViewCube, DRO strip, turntable choreography, section view, materials, capture (raster). Gate: `deno task bench:viewport` budgets (RENDERING §8); manual: load fan GLB, orbit/pan/zoom/pivot/views all correct at 60 fps tier-A.

**M6 — End-to-end wiring.** Harness↔WS↔UI↔viewport joined; F2 golden path live; F3/F4/F5 induced-failure runs behave per USER_FLOWS; capture_viewport tool round-trip; export flow; cancel; queued message. Gate: scripted E2E of USER_FLOWS F2, F3, F7, F9, F12 against the real engine (mock model for failure injection, real model for one smoke).

**M7 — Path tracing + showcase.** three-gpu-pathtracer integration per RENDERING §5–7, GPU tier probe + persistence + watchdog, raster→PT blend, showcase export modal, WebGPU-raster flag. Gate: tier-A machine reaches 256 spp <15 s @1080p; interaction always snaps to raster <1 frame; context-loss drill recovers.

**M8 — Hardening & package.** Retention GC, self-test CLI, `deno task build` (vite build, dotnet publish, deno compile), desktop window launch (deno desktop / `--app=` fallback), perf budget run (SYS_DESIGN §8), `/ponytail-audit` + debt ledger burn-down, docs delta PRs. Gate: `picoforged --selftest` exits 0 on a clean machine following README §5 only; all budgets met; F0–F14 pass end-to-end.

## 5. Testing strategy (summary — details live per milestone)

Unit (brief validator, Kit golden volumes, prompt renderers, repos, reducers) · protocol (zod schema round-trips, RPC framing fuzz: truncated/interleaved/garbage lines never kill the client) · golden transcripts (mock model) · E2E Playwright on USER_FLOWS · bench tasks as regression gates. Failure injection is first-class: every SYS_DESIGN §6 row has at least one test that triggers it deliberately.

## 6. Risk register (check when entering the related milestone)

| Risk | Mitigation |
|---|---|
| PicoGK v2.x signature drift vs docs | DumpApi is truth; Runner adapts at compile time; never hand-type kernel signatures |
| `node:sqlite` lacks FTS5 | boot probe → `jsr:@db/sqlite` fallback behind repo interface (DATA_SCHEMA §1) |
| Anthropic API shape changes | verify per doctrine §3.11; `anthropic.ts` is the only file touching the SDK |
| three-gpu-pathtracer perf/compat | tiering + watchdog + RT-off is a supported mode, not an error |
| GLB export lib friction in sandbox | STL is the contract; GLB optional fast-path, feature-flagged |
| `deno desktop` API newness | Chromium `--app=` fallback is fully supported, wizard-tested |
| Ponytail over-pruning spec structure | §1 precedence rule; reviewer checks deletions against spec references |

## 7. Definition of done (the whole project)

Clean machine + README §5 → working app; fan-impeller golden path <60 s with a real model; every USER_FLOW passes; every §6 failure drill passes; zero `any`/TODO; budgets met; ponytail debt ledger empty or ticketed; graphify LESSONS.md updated; graph committed.

## 8. When stuck (in order)

1. `graphify query` the question; `graphify explain` the symbol. 2. Re-read the spec section the code references. 3. Write the failing test that states the confusion. 4. Make the smallest change that passes (ponytail rung 6–7). 5. Still stuck after two attempts → write a `DECISION:` note in the PR describing the fork and pick the option that adds the least code. Never widen a type, delete a validator, or bypass the sandbox to get unstuck.

## 9. Git Workflow & Commits

As an agent operating in this workspace, follow this Git hygiene:
1. **When to Commit**: Commit code immediately after a logical chunk of work is verified and working. This includes passing a milestone gate (M0–M8), implementing a full component, or fixing a bug. Never leave the workspace with uncommitted code after a major transition.
2. **Pre-Commit Checks**: Before staging, ensure `deno task check` (for TS) or `dotnet build/test` (for C#) passes. If structural files changed, ensure `graphify update .` has run.
3. **Commit Messages**: Write concise, descriptive commit messages prefixing the milestone or component (e.g., `M2: Add anthropic tool schemas and headless orchestrator`).
4. **Push Automatically**: After committing, immediately push to `origin main` to keep the remote synchronized and prevent data loss.
