# Graph Report - 001_picogk_X7  (2026-07-10)

## Corpus Check
- 209 files · ~167,377 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1818 nodes · 2342 edges · 152 communities (139 shown, 13 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 56 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `19a8783f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Kit
- Compiler
- log.ts
- __init__.py
- hooks.test.js
- index.ts
- tasks
- run.py
- M1 Engine — Complete ✅
- robustness-audit.js
- tasks.py
- orchestrator.ts
- err
- package.json
- ponytail-runtime.js
- LLM_HARNESS.md — The Agent Core
- package.json
- LLM_HARNESS.md — The Agent Core
- events.ts
- correctness.js
- SYS_DESIGN.md — PicoForge System Architecture
- compilerOptions
- SYS_DESIGN.md — PicoForge System Architecture
- judge.py
- index.js
- uninstall.test.js
- setup_workspace.py
- Kit.Tests
- M0 Complete ✅
- anthropic.ts
- SandboxPool
- USER_FLOWS.md — End-to-End Flows (with failure branches)
- compilerOptions
- USER_FLOWS.md — End-to-End Flows (with failure branches)
- The GitHub Repo Role
- MCP_SERVER.md — PicoForge as an MCP Server ("Bring Your Own Model" Mode)
- EngineSupervisor
- submitDesignBrief.ts
- README.ko.md
- Install
- Runner.cs
- README.md
- ponytail-config.js
- openclaw-skills.test.js
- generate-examples.mjs
- AGENTS.md — PicoForge Build Playbook
- PicoForge — What I Understood
- README.es.md
- 2026-06-18-agentic.md
- instructions.js
- package.json
- Install
- check-rule-copies.js
- gemini-extension.test.js
- PICOGK_KNOWLEDGE.md — Kernel API, Kit Helpers, Recipes, Physics
- AGENTS.md — PicoForge Build Playbook
- App.tsx
- PICOGK_KNOWLEDGE.md — Kernel API, Kit Helpers, Recipes, Physics
- Cost verification: reproducing the "47-77% cheaper" claim (2026-06-17)
- Agentic benchmark: does ponytail cut code without cutting safety?
- getDefaultMode
- Instalación
- DATA_SCHEMA.md — Local Persistence
- RENDERING.md — Viewport & Ray-Traced Showcase Pipeline
- DATA_SCHEMA.md — Local Persistence
- RENDERING.md — Viewport & Ray-Traced Showcase Pipeline
- Agentic benchmark
- Ponytail v4 hardening — A–F benchmark vs Caveman (2026-06-12)
- Platform-Native Solutions
- Rate Limiting in FastAPI
- ponytail-activate.js
- ponytailExtension
- opencode-plugin.test.js
- PICOFORGE — Chat-to-Part Computational Engineering Studio
- UIUX.md — Design System & Interface Specification
- PICOFORGE — Chat-to-Part Computational Engineering Studio
- UIUX.md — Design System & Interface Specification
- Benchmark
- Robustness audit: does ponytail degrade weak models? (2026-06-16)
- Comprehension & reuse: fixing #245 and #217
- React Countdown Timer Component
- Ponytail
- Ponytail
- hooks-windows.test.js
- Chat Conversation
- behavior.test.js
- benchmark-local.py
- marketplace.json
- README.md
- Email Validation Function
- Ponytail Help
- check-versions.js
- Ponytail Help
- commands.test.js
- copilot-plugin.test.js
- qoder-plugin.test.js
- PicoForge Build Log
- Caveman vs Ponytail — 2026-06-12
- Debounce Search Input
- Installing Deno on Windows
- caveman-SKILL.md
- Local model benchmark: llama3.2 via Ollama — 2026-06-15
- 2026-06-16-correctness-gate-fix.md
- csv-sum.md
- package.json
- package-scripts.test.js
- package.test.js
- SKILL.md
- Ponytail Gain
- SKILL.md
- ponytail-mcp
- SKILL.md
- Ponytail Gain
- SKILL.md
- M2 — LLM Harness — Complete
- Program.cs
- caveman.js
- ponytail.js
- Deep Clone
- Group By
- Infinite Scroll
- Modal Dialog
- Number Formatting
- URL Parameters
- SKILL.md
- SKILL.md
- tsconfig.json
- What I Was About to Do
- react-countdown.md
- opencode.json
- 00-picoforge.md
- graphify.md
- ponytail.md
- graphify.md
- after-install.md
- ponytail.md
- ponytail.md
- ponytail-statusline.sh script
- ponytail.md
- ponytail.md

## God Nodes (most connected - your core abstractions)
1. `M1 Engine — Complete ✅` - 28 edges
2. `Kit` - 27 edges
3. `Ctx` - 23 edges
4. `compilerOptions` - 19 edges
5. `M0 Complete ✅` - 19 edges
6. `ok` - 18 edges
7. `err` - 18 edges
8. `PicoForge — What I Understood` - 18 edges
9. `getPonytailInstructions()` - 16 edges
10. `KitGoldenTests` - 16 edges

## Surprising Connections (you probably didn't know these)
- `main()` --indirect_call--> `outPath()`  [INFERRED]
  picoforge/scripts/setup.ts → picoforge/.tools/ponytail/scripts/build-openclaw-skills.js
- `readMode()` --calls--> `normalizePersistedMode()`  [EXTRACTED]
  picoforge/.tools/ponytail/.opencode/plugins/ponytail.mjs → picoforge/.tools/ponytail/hooks/ponytail-config.js
- `register()` --references--> `skillsDir`  [EXTRACTED]
  picoforge/.tools/ponytail/__init__.py → picoforge/.tools/ponytail/scripts/publish-openclaw-skills.js
- `register()` --references--> `skillCommands`  [EXTRACTED]
  picoforge/.tools/ponytail/__init__.py → picoforge/.tools/ponytail/tests/hermes-plugin.test.js
- `parse_complete()` --calls--> `parse_score()`  [INFERRED]
  picoforge/.tools/ponytail/benchmarks/agentic/complete.py → picoforge/.tools/ponytail/benchmarks/agentic/judge.py

## Import Cycles
- None detected.

## Communities (152 total, 13 thin omitted)

### Community 0 - "Kit"
Cohesion: 0.07
Nodes (26): BBox3, PicoForge.Kit, Kit.Tests, Fact, float, Func, IImplicit, Matrix4x4 (+18 more)

### Community 1 - "Compiler"
Cohesion: 0.05
Nodes (28): AttributeSyntax, ConcurrentDictionary, ForgeEngine, CSharpSyntaxWalker, int, JsonNode, MemberAccessExpressionSyntax, HashSet (+20 more)

### Community 2 - "log.ts"
Cohesion: 0.07
Nodes (37): log, main(), ROOT, run(), step(), Config, ConfigSchema, loadApiKey() (+29 more)

### Community 3 - "__init__.py"
Cohesion: 0.07
Nodes (39): Any, build_injected_context(), _config_dir(), _default_mode(), _fallback_instructions(), _filter_skill_body_for_mode(), _handle_mode_command(), _make_skill_command_handler() (+31 more)

### Community 4 - "hooks.test.js"
Cohesion: 0.05
Nodes (40): assert, claudeEnv, codexData, codexEnv, codexState, copilotData, customConfigDir, { DEFAULT_MODE, getDefaultMode, isShellSafe, writeDefaultMode } (+32 more)

### Community 5 - "index.ts"
Cohesion: 0.09
Nodes (32): ToolDefinition, askUserTool, Input, jsonSchema, zodInput, makeDef(), RunCtx, ToolModule (+24 more)

### Community 6 - "tasks"
Cohesion: 0.05
Nodes (37): compilerOptions, lib, noFallthroughCasesInSwitch, noImplicitAny, noUnusedLocals, noUnusedParameters, strict, strictNullChecks (+29 more)

### Community 7 - "run.py"
Cohesion: 0.12
Nodes (31): aggregate(), chat_code_loc(), _claude_version(), code_stats(), _count(), _git(), git_diff_stats(), _git_snapshot() (+23 more)

### Community 8 - "M1 Engine — Complete ✅"
Cohesion: 0.06
Nodes (32): Deno Server (M1 additions), ForgeEngine (C# — managed-only host), ForgeSandbox (C# — only project touching PicoGK), Kit.Tests — [8 golden-volume tests](file:///v:/_PORJECTS/001_picogk_X7/picoforge/engine/Kit.Tests/PlaceholderTest.cs), M1 Engine — Complete ✅, Planner Response, Planner Response, Planner Response (+24 more)

### Community 9 - "robustness-audit.js"
Cohesion: 0.08
Nodes (25): { checkPy, pyBlock, TASKS }, email, fs, kv, MODELS, path, skill, { checkPy, pyBlock, TASKS } (+17 more)

### Community 10 - "tasks.py"
Cohesion: 0.17
Nodes (28): _contained(), _fail(), _find(), _find_class(), _import(), _import_pkg(), _ok(), Path (+20 more)

### Community 11 - "orchestrator.ts"
Cohesion: 0.11
Nodes (21): AnthropicMessage, ac, userPrompt, DEFAULT_SETTINGS, driveRun(), log, OrchestratorCallbacks, RunState (+13 more)

### Community 12 - "err"
Cohesion: 0.13
Nodes (10): err, ok, Result, EngineClient, EngineCompileResult, EngineHelloResult, EnginePingResult, EngineRunParams (+2 more)

### Community 13 - "package.json"
Cohesion: 0.08
Nodes (25): author, name, url, bugs, url, description, exports, ./plugin (+17 more)

### Community 14 - "ponytail-runtime.js"
Cohesion: 0.12
Nodes (22): getConfigDir(), isDeactivationCommand(), { clearMode, isQoder, readMode, setMode, writeHookOutput }, finish(), { getDefaultMode, isDeactivationCommand, writeDefaultMode }, { getPonytailInstructions }, clearMode(), fs (+14 more)

### Community 15 - "LLM_HARNESS.md — The Agent Core"
Cohesion: 0.08
Nodes (23): 10. Multi-turn edits ("make the blades thicker"), 11. Harness test suite (must exist before UI work — AGENTS M2), 1. Why this design is hard to fail (the eight load-bearing decisions), 2. Components, 3. SYSTEM PROMPT (verbatim template), 4.1 Structural check (regex + Roslyn syntax tree), 4.2 Banned-symbol analyzer (engine `Analyzers.cs`), 4.3 Unknown-symbol pre-pass (+15 more)

### Community 16 - "package.json"
Cohesion: 0.08
Nodes (23): dependencies, @base-ui/react, camera-controls, react, react-dom, three, three-gpu-pathtracer, devDependencies (+15 more)

### Community 17 - "LLM_HARNESS.md — The Agent Core"
Cohesion: 0.08
Nodes (23): 10. Multi-turn edits ("make the blades thicker"), 11. Harness test suite (must exist before UI work — AGENTS M2), 1. Why this design is hard to fail (the eight load-bearing decisions), 2. Components, 3. SYSTEM PROMPT (verbatim template), 4.1 Structural check (regex + Roslyn syntax tree), 4.2 Banned-symbol analyzer (engine `Analyzers.cs`), 4.3 Unknown-symbol pre-pass (+15 more)

### Community 18 - "events.ts"
Cohesion: 0.08
Nodes (22): ChatBlockEvent, ChatDeltaEvent, ChatDoneEvent, ClientEvent, ClientEventSchema, ErrorEvent, GeometryReadyEvent, GeometryStats (+14 more)

### Community 19 - "correctness.js"
Cohesion: 0.10
Nodes (17): CHECKS, correctnessTimeoutMs(), exec(), { execSync }, fs, os, path, python() (+9 more)

### Community 20 - "SYS_DESIGN.md — PicoForge System Architecture"
Cohesion: 0.10
Nodes (20): 10. Security posture (local app, still disciplined), 11. Packaging & modes, 1. Design goals → architectural consequences, 2. Process topology, 3.1 Module map, 3.2 HTTP API (REST, JSON), 3.3 WebSocket protocol (`/ws?conversationId=`), 3.4 Settings & secrets (+12 more)

### Community 21 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+12 more)

### Community 22 - "SYS_DESIGN.md — PicoForge System Architecture"
Cohesion: 0.10
Nodes (20): 10. Security posture (local app, still disciplined), 11. Packaging & modes, 1. Design goals → architectural consequences, 2. Process topology, 3.1 Module map, 3.2 HTTP API (REST, JSON), 3.3 WebSocket protocol (`/ws?conversationId=`), 3.4 Settings & secrets (+12 more)

### Community 23 - "judge.py"
Cohesion: 0.20
Nodes (19): main(), parse_complete(), _rank_ok(), scores: {(task_id, label): {SCORE_KEY: int}}. For each task the 'complete' label, Live: the judge model must rank each complete ref above its stub., No API, no key: prove the GATE catches under-delivery. A well-ordered matrix mus, run(), selftest() (+11 more)

### Community 24 - "index.js"
Cohesion: 0.17
Nodes (18): normalizeMode(), normalizePersistedMode(), { DEFAULT_MODE, normalizeMode, normalizePersistedMode }, filterSkillBodyForMode(), fs, getFallbackInstructions(), getPonytailInstructions(), INDEPENDENT_MODES (+10 more)

### Community 25 - "uninstall.test.js"
Cohesion: 0.10
Nodes (18): assert, claudeDir, configDir, configPath, env, flagPath, fs, home (+10 more)

### Community 26 - "setup_workspace.py"
Cohesion: 0.30
Nodes (17): Ctx, have(), main(), Path, Run a command; never raises. Returns (exitcode, combined tail output)., Always-on ruleset into .agents/rules/ (Antigravity reads it every session)., Install the graphifyy package, then wire Antigravity + the git hook., run() (+9 more)

### Community 27 - "Kit.Tests"
Cohesion: 0.12
Nodes (16): Microsoft.CodeAnalysis.CSharp (4.*), Microsoft.NET.Test.Sdk (17.*), PicoGK (2.2.*), System.Text.Json (9.*), xunit (2.*), xunit.runner.visualstudio (2.*), ForgeEngine, net9.0 (+8 more)

### Community 28 - "M0 Complete ✅"
Cohesion: 0.11
Nodes (19): Files created (24 total), M0 Complete ✅, Planner Response, Planner Response, Planner Response, Planner Response, Planner Response, Planner Response (+11 more)

### Community 29 - "anthropic.ts"
Cohesion: 0.15
Nodes (14): BACKOFF_MS, createMessageStream(), getClient(), log, MessageContent, RETRYABLE, runStream(), sleep() (+6 more)

### Community 30 - "SandboxPool"
Cohesion: 0.15
Nodes (11): bool, CancellationToken, IDisposable, Action, Lock, string, RunLimits, SandboxPool (+3 more)

### Community 31 - "USER_FLOWS.md — End-to-End Flows (with failure branches)"
Cohesion: 0.12
Nodes (16): F0 · First run, F10 · Engine dies mid-run, F11 · API unreachable / 429, F12 · Reload / resume, F13 · Inspect & section, F14 · Showcase render, F1 · Create project, F2 · "Build a turbine for my fan" — the golden path (full trace) (+8 more)

### Community 32 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+8 more)

### Community 33 - "USER_FLOWS.md — End-to-End Flows (with failure branches)"
Cohesion: 0.12
Nodes (16): F0 · First run, F10 · Engine dies mid-run, F11 · API unreachable / 429, F12 · Reload / resume, F13 · Inspect & section, F14 · Showcase render, F1 · Create project, F2 · "Build a turbine for my fan" — the golden path (full trace) (+8 more)

### Community 34 - "The GitHub Repo Role"
Cohesion: 0.13
Nodes (15): Planner Response, Planner Response, Planner Response, Planner Response, Planner Response, Planner Response, Planner Response, Planner Response (+7 more)

### Community 35 - "MCP_SERVER.md — PicoForge as an MCP Server ("Bring Your Own Model" Mode)"
Cohesion: 0.13
Nodes (14): 10. Acceptance gate (M9), 1. Concept, 2. Architecture, 3. Sessions, 4.1 Tools (names and schemas are the LLM_HARNESS §5 schemas, verbatim), 4.2 Resources (read-only; URIs stable), 4.3 Prompts, 4. Exposed surface (+6 more)

### Community 36 - "EngineSupervisor"
Cohesion: 0.18
Nodes (5): BACKOFF_MS, EngineStatus, EngineSupervisor, log, SupervisorState

### Community 37 - "submitDesignBrief.ts"
Cohesion: 0.16
Nodes (12): BriefValidationResult, CATEGORIES, Input, jsonSchema, MATERIALS, parameterSchema, physicsCheckSchema, PROJECT_ENVELOPE_MM (+4 more)

### Community 38 - "README.ko.md"
Cohesion: 0.13
Nodes (13): Adapter Rule, Agent Portability, Portable Behavior, Supported Adapters, Before / after, Commands, Development, FAQ (+5 more)

### Community 39 - "Install"
Cohesion: 0.13
Nodes (15): Antigravity CLI, Claude Code, CodeWhale, Codex, Devin CLI, Gemini CLI, GitHub Copilot CLI, Hermes Agent (+7 more)

### Community 40 - "Runner.cs"
Cohesion: 0.18
Nodes (8): ForgeSandbox, JsonElement, Dictionary, Voxels, JobSpec, LimitsSpec, ReportStats, Runner

### Community 41 - "README.md"
Cohesion: 0.14
Nodes (11): Ponytail, lazy senior dev mode, Ponytail, lazy senior dev mode, Before / after, Commands, Development, FAQ, How it works, License (+3 more)

### Community 42 - "ponytail-config.js"
Cohesion: 0.16
Nodes (11): fs, getClaudeDir(), isShellSafe(), normalizeConfigMode(), os, path, VALID_MODES, fs (+3 more)

### Community 43 - "openclaw-skills.test.js"
Cohesion: 0.21
Nodes (12): DESCRIPTIONS, fs, NAMES, outPath(), path, render(), ROOT, sourceBody() (+4 more)

### Community 44 - "generate-examples.mjs"
Cohesion: 0.18
Nodes (10): isHaiku(), j, meta, pick(), rows, tbl, assert, cases (+2 more)

### Community 45 - "AGENTS.md — PicoForge Build Playbook"
Cohesion: 0.17
Nodes (11): 0. Prime directive, 1. PONYTAIL — how you write code here (active: `full`), 2. GRAPHIFY — how you navigate and remember here, 3. Engineering doctrine — the "no crashes" law, 4. Milestones (build in order; a gate failing blocks the next milestone), 5. Testing strategy (summary — details live per milestone), 6. Risk register (check when entering the related milestone), 7. Definition of done (the whole project) (+3 more)

### Community 46 - "PicoForge — What I Understood"
Cohesion: 0.17
Nodes (12): Current State of the Workspace, How PicoGK is Used, PicoForge — What I Understood, Tech Stack (Locked), The 9 Milestones (Build Order), The Big Idea, The Build Pipeline (What Happens When You Send a Message), The DumpApi Tool (The Critical Link) (+4 more)

### Community 47 - "README.es.md"
Cohesion: 0.17
Nodes (10): Ponytail, lazy senior dev mode, Antes / después, Comandos, Cómo funciona, Desarrollo, FAQ, Historial de estrellas, Licencia (+2 more)

### Community 48 - "2026-06-18-agentic.md"
Cohesion: 0.18
Nodes (9): Agentic safety benchmark (2026-06-17): SUPERSEDED, Finding 1: the code-size gap collapses with a fair baseline, Finding 2: minimizing lines without a floor drops safety, Finding 3: over-engineering did not appear (null result, two ways), Reproduce, Results, TL;DR, What this does and does not show (+1 more)

### Community 49 - "instructions.js"
Cohesion: 0.27
Nodes (9): modeArg, server, { version }, buildInstructions(), { getDefaultMode, normalizeMode }, { getPonytailInstructions }, MODES, require (+1 more)

### Community 50 - "package.json"
Cohesion: 0.17
Nodes (11): dependencies, @modelcontextprotocol/sdk, zod, description, license, name, private, scripts (+3 more)

### Community 51 - "Install"
Cohesion: 0.17
Nodes (12): Antigravity CLI, Claude Code, CodeWhale, Codex, Devin CLI, Gemini CLI, GitHub Copilot CLI, Install (+4 more)

### Community 52 - "check-rule-copies.js"
Cohesion: 0.17
Nodes (9): agents, canonical, copies, fs, INVARIANTS, path, root, skill (+1 more)

### Community 53 - "gemini-extension.test.js"
Cohesion: 0.18
Nodes (11): assert, fs, loadManifest(), path, read(), REUSED_COMMANDS, REUSED_SKILLS, root (+3 more)

### Community 54 - "PICOGK_KNOWLEDGE.md — Kernel API, Kit Helpers, Recipes, Physics"
Cohesion: 0.18
Nodes (10): 1. [KB] PicoGK mental model, 2. [KB] Coordinate & authoring conventions (enforced by validators), 3. PicoGK API card (compressed form the model sees — generated, this is the template), 4. `PicoForge.Kit` — the golden helper library (implement in M1, this is the contract), 5. [KB] Physics formula pack (the agent's checkable math), 6. [KB] Recipe: axial fan impeller (canonical, ships as `recipes/rotor_fan`), 7. [KB] Recipe stubs (each ~1 page in KB with formulas + Kit composition), 8. Materials table (Kit `Material` presets; brief validator source of truth) (+2 more)

### Community 55 - "AGENTS.md — PicoForge Build Playbook"
Cohesion: 0.18
Nodes (10): 0. Prime directive, 1. PONYTAIL — how you write code here (active: `full`), 2. GRAPHIFY — how you navigate and remember here, 3. Engineering doctrine — the "no crashes" law, 4. Milestones (build in order; a gate failing blocks the next milestone), 5. Testing strategy (summary — details live per milestone), 6. Risk register (check when entering the related milestone), 7. Definition of done (the whole project) (+2 more)

### Community 56 - "App.tsx"
Cohesion: 0.20
Nodes (3): App(), DotStatus, root

### Community 57 - "PICOGK_KNOWLEDGE.md — Kernel API, Kit Helpers, Recipes, Physics"
Cohesion: 0.18
Nodes (10): 1. [KB] PicoGK mental model, 2. [KB] Coordinate & authoring conventions (enforced by validators), 3. PicoGK API card (compressed form the model sees — generated, this is the template), 4. `PicoForge.Kit` — the golden helper library (implement in M1, this is the contract), 5. [KB] Physics formula pack (the agent's checkable math), 6. [KB] Recipe: axial fan impeller (canonical, ships as `recipes/rotor_fan`), 7. [KB] Recipe stubs (each ~1 page in KB with formulas + Kit composition), 8. Materials table (Kit `Material` presets; brief validator source of truth) (+2 more)

### Community 58 - "Cost verification: reproducing the "47-77% cheaper" claim (2026-06-17)"
Cohesion: 0.18
Nodes (9): Claude (pooled, 30 reps, USD for 5 tasks), Cost verification: reproducing the "47-77% cheaper" claim (2026-06-17), Gemini, Method, Notes, OpenAI (10 reps, USD for 5 tasks), Results, Takeaway (+1 more)

### Community 59 - "Agentic benchmark: does ponytail cut code without cutting safety?"
Cohesion: 0.18
Nodes (11): A contamination bug we found in our own numbers, Agentic benchmark: does ponytail cut code without cutting safety?, Axis 1: lines of code on real features (12 tasks), Axis 2: does minimizing drop a guard? (6 tasks), Conclusion, Limitations (so this can't be the next thing someone debunks), Reproduce, Setup (+3 more)

### Community 60 - "getDefaultMode"
Cohesion: 0.20
Nodes (9): getDefaultMode(), RUNTIME_MODES, __dirname, { getDefaultMode, normalizePersistedMode }, { getPonytailInstructions }, { parseCommandFile }, readMode(), require (+1 more)

### Community 61 - "Instalación"
Cohesion: 0.18
Nodes (11): Antigravity CLI, Claude Code, CodeWhale, Codex, Devin CLI, Gemini CLI, GitHub Copilot CLI, Instalación (+3 more)

### Community 62 - "DATA_SCHEMA.md — Local Persistence"
Cohesion: 0.20
Nodes (9): 1. Engine & pragmas, 2. Entity relationship overview, 3. DDL, 4. Query patterns the schema must serve fast (verify with EXPLAIN in tests), 5. Transactions, 6. Migrations, 7. Retention / GC, 8. Backup story (+1 more)

### Community 63 - "RENDERING.md — Viewport & Ray-Traced Showcase Pipeline"
Cohesion: 0.20
Nodes (9): 1. ViewportEngine public API (the whole surface React may touch), 2. Geometry ingest, 3. Scene & studio lighting (the "showcase" look), 4. Camera model (Fusion-360 feel, ortho default), 5. Two-path rendering & the mode ladder, 6. GPU tiering (probe at first run, stored in settings, degradable at runtime), 7. Capture service (feeds the `capture_viewport` tool and user exports), 8. Performance & memory budget (+1 more)

### Community 64 - "DATA_SCHEMA.md — Local Persistence"
Cohesion: 0.20
Nodes (9): 1. Engine & pragmas, 2. Entity relationship overview, 3. DDL, 4. Query patterns the schema must serve fast (verify with EXPLAIN in tests), 5. Transactions, 6. Migrations, 7. Retention / GC, 8. Backup story (+1 more)

### Community 65 - "RENDERING.md — Viewport & Ray-Traced Showcase Pipeline"
Cohesion: 0.20
Nodes (9): 1. ViewportEngine public API (the whole surface React may touch), 2. Geometry ingest, 3. Scene & studio lighting (the "showcase" look), 4. Camera model (Fusion-360 feel, ortho default), 5. Two-path rendering & the mode ladder, 6. GPU tiering (probe at first run, stored in settings, degradable at runtime), 7. Capture service (feeds the `capture_viewport` tool and user exports), 8. Performance & memory budget (+1 more)

### Community 66 - "Agentic benchmark"
Cohesion: 0.20
Nodes (10): Agentic benchmark, Arms, Completeness judge (`complete.py`), Metrics, Over-engineering judge (`judge.py`), Reproduce, Results, Tasks (+2 more)

### Community 67 - "Ponytail v4 hardening — A–F benchmark vs Caveman (2026-06-12)"
Cohesion: 0.20
Nodes (9): Acceptance criteria (brief §5.6), Addendum: same-model control arm (control2, added same day), Build phase — non-blank LOC / .py files (scorer-verified), Correctness, Extension phase (tasks C, D — surprise requests, git-measured), Ponytail v4 hardening — A–F benchmark vs Caveman (2026-06-12), Residual (honest notes), Safety — adversarial probes (independently executed) (+1 more)

### Community 68 - "Platform-Native Solutions"
Cohesion: 0.20
Nodes (9): CSS Capabilities, Database, HTML Elements, JavaScript / Browser APIs, Node.js Standard Library, Platform-Native Solutions, Python Standard Library, Swift / SwiftUI (+1 more)

### Community 69 - "Rate Limiting in FastAPI"
Cohesion: 0.20
Nodes (10): 1. **Using `slowapi` (Recommended - Easiest)**, 2. **Using `limits` Library (More Control)**, 3. **Custom Middleware (Full Control)**, 4. **Per-User Rate Limiting (With Authentication)**, 5. **Redis-Based Rate Limiting (Production)**, 6. **Complete Example with Multiple Endpoints**, Comparison Table, Rate Limiting in FastAPI (+2 more)

### Community 70 - "ponytail-activate.js"
Cohesion: 0.20
Nodes (9): claudeDir, {
  clearMode,
  isCodex,
  isCopilot,
  setMode,
  writeHookOutput,
}, fs, { getDefaultMode, getClaudeDir, isShellSafe }, { getPonytailInstructions }, mode, output, path (+1 more)

### Community 71 - "ponytailExtension"
Cohesion: 0.27
Nodes (6): getConfigPath(), getHideStatus(), getQuietStartup(), writeDefaultMode(), ponytailExtension(), createPiHarness()

### Community 72 - "opencode-plugin.test.js"
Cohesion: 0.20
Nodes (8): assert, fs, os, path, { pathToFileURL }, statePath, test, tmp

### Community 73 - "PICOFORGE — Chat-to-Part Computational Engineering Studio"
Cohesion: 0.22
Nodes (8): 1. What this document pack is, 2. The product in 30 seconds, 3. Non-negotiable invariants (the whole pack enforces these), 4. Technology decisions (locked), 5. Quickstart (once implemented), 6. Glossary, 7. Scope fences for v1, PICOFORGE — Chat-to-Part Computational Engineering Studio

### Community 74 - "UIUX.md — Design System & Interface Specification"
Cohesion: 0.22
Nodes (8): 1. Layout — the split, 2. Design tokens (`app/src/styles/tokens.css` — single source of visual truth), 3. Components (Base UI mapping + custom), 4. Viewport interaction spec (feel = Fusion 360; engine details in RENDERING.md), 5. Global keyboard map, 6. First-run wizard (Dialog, 3 steps, mono checklist aesthetic), 7. Copy rules, UIUX.md — Design System & Interface Specification

### Community 75 - "PICOFORGE — Chat-to-Part Computational Engineering Studio"
Cohesion: 0.22
Nodes (8): 1. What this document pack is, 2. The product in 30 seconds, 3. Non-negotiable invariants (the whole pack enforces these), 4. Technology decisions (locked), 5. Quickstart (once implemented), 6. Glossary, 7. Scope fences for v1, PICOFORGE — Chat-to-Part Computational Engineering Studio

### Community 76 - "UIUX.md — Design System & Interface Specification"
Cohesion: 0.22
Nodes (8): 1. Layout — the split, 2. Design tokens (`app/src/styles/tokens.css` — single source of visual truth), 3. Components (Base UI mapping + custom), 4. Viewport interaction spec (feel = Fusion 360; engine details in RENDERING.md), 5. Global keyboard map, 6. First-run wizard (Dialog, 3 steps, mono checklist aesthetic), 7. Copy rules, UIUX.md — Design System & Interface Specification

### Community 77 - "Benchmark"
Cohesion: 0.22
Nodes (9): Benchmark, Claude (Haiku / Sonnet / Opus), Independent benchmarks, Local models via Ollama, Median results (10 runs, 2026-06-13; cost re-verified at 30 runs, 2026-06-17), Metrics, Notes, Prerequisites (+1 more)

### Community 78 - "Robustness audit: does ponytail degrade weak models? (2026-06-16)"
Cohesion: 0.22
Nodes (8): Conclusion, Edge-case traps (n=20/cell), Method, Reproduce, Robustness audit: does ponytail degrade weak models? (2026-06-16), The fix that wasn't, TL;DR, Validators: the email slip is provider-specific

### Community 79 - "Comprehension & reuse: fixing #245 and #217"
Cohesion: 0.22
Nodes (8): #217: rung shipped, failure did not reproduce, Comprehension & reuse: fixing #245 and #217, Haiku: a model ceiling, not a regression, Regression check: did the rule edits break anything?, Results — `trace-transfer`, n=6, root-cause-fix rate, The #245 reproducer, The fix, Verdict

### Community 80 - "React Countdown Timer Component"
Cohesion: 0.22
Nodes (9): Advanced Timer with Formatted Display, Basic Countdown Timer, CSS Styling, Custom Hook Version, Features, React Countdown Timer Component, Styled Component with Animations, Usage Examples (+1 more)

### Community 81 - "Ponytail"
Cohesion: 0.22
Nodes (8): Boundaries, Intensity, Output, Persistence, Ponytail, Rules, The ladder, When NOT to be lazy

### Community 82 - "Ponytail"
Cohesion: 0.22
Nodes (8): Boundaries, Intensity, Output, Persistence, Ponytail, Rules, The ladder, When NOT to be lazy

### Community 83 - "hooks-windows.test.js"
Cohesion: 0.22
Nodes (7): assert, fs, HOST_PLUGIN_MANIFESTS, path, root, { spawn }, test

### Community 84 - "Chat Conversation"
Cohesion: 0.25
Nodes (7): Chat Conversation, Planner Response, Planner Response, Planner Response, Planner Response, User Input, User Input

### Community 85 - "behavior.test.js"
Cohesion: 0.29
Nodes (5): CHECKS, assert, behavior, check(), test

### Community 86 - "benchmark-local.py"
Cohesion: 0.39
Nodes (7): call_ollama(), count_loc(), load_arms(), main(), Ponytail local benchmark — runs the same 5 tasks against any Ollama model. No p, Non-blank, non-comment lines of code: fenced blocks, or the whole     response, run()

### Community 87 - "marketplace.json"
Cohesion: 0.25
Nodes (7): description, name, owner, name, url, plugins, $schema

### Community 88 - "README.md"
Cohesion: 0.25
Nodes (5): Debounce, Without Ponytail, 116 lines of code, Rate Limiting, Without Ponytail, 128 lines of code, Examples

### Community 89 - "Email Validation Function"
Cohesion: 0.25
Nodes (7): Comparison, Email Validation, Email Validation Function, More Robust Version (with additional checks), Using a Third-Party Library (Recommended for Production), With Ponytail, 3 lines of code, Without Ponytail, 75 lines of code

### Community 90 - "Ponytail Help"
Cohesion: 0.25
Nodes (7): Configure Default Mode, Deactivate, Levels, More, Ponytail Help, Skills, Update

### Community 91 - "check-versions.js"
Cohesion: 0.25
Nodes (6): distinct, fs, path, root, VERSION_FILES, versions

### Community 92 - "Ponytail Help"
Cohesion: 0.25
Nodes (7): Configure Default Mode, Deactivate, Levels, More, Ponytail Help, Skills, Update

### Community 93 - "commands.test.js"
Cohesion: 0.25
Nodes (7): assert, commands, fs, path, piSource, root, test

### Community 94 - "copilot-plugin.test.js"
Cohesion: 0.25
Nodes (6): assert, fs, path, REQUIRED_COMMAND_FILES, root, test

### Community 95 - "qoder-plugin.test.js"
Cohesion: 0.25
Nodes (6): assert, fs, path, root, SKILL_DIRS, test

### Community 96 - "PicoForge Build Log"
Cohesion: 0.29
Nodes (6): 10/07/2026 09:24 AM, 10/07/2026 09:25 AM, 10/07/2026 09:26 AM, 10/07/2026 09:42 AM → M1 ENGINE IN PROGRESS, 10/07/2026 09:57 AM → M0 SCAFFOLD COMPLETE, PicoForge Build Log

### Community 97 - "Caveman vs Ponytail — 2026-06-12"
Cohesion: 0.29
Nodes (6): Caveman vs Ponytail — 2026-06-12, Ponytail v1 (before this benchmark), Ponytail v2 (after fixes), Ponytail v3 (skill file compressed), v1 findings, Verdict (v3)

### Community 98 - "Debounce Search Input"
Cohesion: 0.29
Nodes (7): Advanced: Debounce with Cancel & Immediate Options, Basic Debounce Function, Debounce Search Input, Enhanced Version with Loading State, HTML Example, Key Benefits, With Ponytail, 10 lines of code

### Community 99 - "Installing Deno on Windows"
Cohesion: 0.33
Nodes (6): After install — verify it works, Installing Deno on Windows, Option 1 — Official PowerShell installer (recommended), Option 2 — winget (if you have Windows Package Manager), Option 3 — Scoop, Then verify PicoForge gates

### Community 100 - "caveman-SKILL.md"
Cohesion: 0.33
Nodes (5): Auto-Clarity, Boundaries, Intensity, Persistence, Rules

### Community 101 - "Local model benchmark: llama3.2 via Ollama — 2026-06-15"
Cohesion: 0.33
Nodes (5): Key findings, Local model benchmark: llama3.2 via Ollama — 2026-06-15, Reproduce, Results (n=5, median), Takeaway

### Community 102 - "2026-06-16-correctness-gate-fix.md"
Cohesion: 0.33
Nodes (5): Claude re-score of committed responses through the fixed gate, Correctness under Ponytail: gate fixes + GPT-mini reproduction (2026-06-16), GPT arms (needs OPENAI_API_KEY in ../.env), The gate bugs, TL;DR

### Community 103 - "csv-sum.md"
Cohesion: 0.33
Nodes (5): Alternative methods:, CSV Sum, Python code to read sales.csv and sum the 'amount' column, With Ponytail, 3 lines of code, Without Ponytail, 20 lines of code

### Community 104 - "package.json"
Cohesion: 0.33
Nodes (5): name, private, scripts, test, type

### Community 105 - "package-scripts.test.js"
Cohesion: 0.33
Nodes (5): assert, fs, path, root, test

### Community 106 - "package.test.js"
Cohesion: 0.33
Nodes (5): assert, fs, path, root, test

### Community 107 - "SKILL.md"
Cohesion: 0.40
Nodes (4): Boundaries, Hunt, Output, Tags

### Community 108 - "Ponytail Gain"
Cohesion: 0.40
Nodes (4): Boundaries, Honesty boundary, Ponytail Gain, Scoreboard

### Community 109 - "SKILL.md"
Cohesion: 0.40
Nodes (4): Boundaries, Examples, Format, Scoring

### Community 110 - "ponytail-mcp"
Cohesion: 0.40
Nodes (4): ponytail-mcp, Run it, Test, What it exposes

### Community 111 - "SKILL.md"
Cohesion: 0.40
Nodes (4): Boundaries, Hunt, Output, Tags

### Community 112 - "Ponytail Gain"
Cohesion: 0.40
Nodes (4): Boundaries, Honesty boundary, Ponytail Gain, Scoreboard

### Community 113 - "SKILL.md"
Cohesion: 0.40
Nodes (4): Boundaries, Examples, Format, Scoring

### Community 114 - "M2 — LLM Harness — Complete"
Cohesion: 0.50
Nodes (4): M2 — LLM Harness — Complete, Planner Response, User Input, What was built

### Community 115 - "Program.cs"
Cohesion: 0.83
Nodes (3): ApiManifest, ApiMember, ApiType

### Community 116 - "caveman.js"
Cohesion: 0.50
Nodes (3): fs, path, system

### Community 117 - "ponytail.js"
Cohesion: 0.50
Nodes (3): fs, path, system

### Community 118 - "Deep Clone"
Cohesion: 0.50
Nodes (3): Deep Clone, With Ponytail, Without Ponytail

### Community 119 - "Group By"
Cohesion: 0.50
Nodes (3): Group By, With Ponytail, Without Ponytail

### Community 120 - "Infinite Scroll"
Cohesion: 0.50
Nodes (3): Infinite Scroll, With Ponytail, Without Ponytail

### Community 121 - "Modal Dialog"
Cohesion: 0.50
Nodes (3): Modal Dialog, With Ponytail, Without Ponytail

### Community 122 - "Number Formatting"
Cohesion: 0.50
Nodes (3): Number Formatting, With Ponytail, Without Ponytail

### Community 123 - "URL Parameters"
Cohesion: 0.50
Nodes (3): URL Parameters, With Ponytail, Without Ponytail

### Community 124 - "SKILL.md"
Cohesion: 0.50
Nodes (3): Boundaries, Output, Scan

### Community 125 - "SKILL.md"
Cohesion: 0.50
Nodes (3): Boundaries, Output, Scan

### Community 127 - "What I Was About to Do"
Cohesion: 0.67
Nodes (3): Planner Response, User Input, What I Was About to Do

## Knowledge Gaps
- **1052 isolated node(s):** `$schema`, `name`, `description`, `name`, `url` (+1047 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ALLOWED_USINGS` connect `index.ts` to `Compiler`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `ForgeEngine` connect `Compiler` to `SandboxPool`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `Run a command; never raises. Returns (exitcode, combined tail output).`, `Always-on ruleset into .agents/rules/ (Antigravity reads it every session).`, `Install the graphifyy package, then wire Antigravity + the git hook.` to the rest of the system?**
  _1081 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Kit` be split into smaller, more focused modules?**
  _Cohesion score 0.06912280701754386 - nodes in this community are weakly interconnected._
- **Should `Compiler` be split into smaller, more focused modules?**
  _Cohesion score 0.05254901960784314 - nodes in this community are weakly interconnected._
- **Should `log.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06972789115646258 - nodes in this community are weakly interconnected._
- **Should `__init__.py` be split into smaller, more focused modules?**
  _Cohesion score 0.07188160676532769 - nodes in this community are weakly interconnected._