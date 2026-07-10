# LLM_HARNESS.md — The Agent Core

This file specifies everything between the user's message and a validated part in the viewport. The guiding principle: **the model is a brilliant but unreliable component; the harness is a deterministic machine that makes its failure modes cheap, visible, and recoverable.** We do not hope the model behaves — we constrain the game so that most misbehaviors are caught before they matter and every caught failure produces exactly the context needed to fix it.

Provider: Anthropic Messages API with native tool use and streaming. Default model `claude-sonnet-4-6`; the model id, max_tokens, and temperature are `settings` keys. **Implementer: verify current model ids, tool-use request/response shapes, and streaming event names against https://docs.claude.com/en/api/overview and the docs map https://docs.claude.com/en/docs_site_map.md before wiring `anthropic.ts` — do not trust memory.**

---

## 1. Why this design is hard to fail (the eight load-bearing decisions)

1. **One pure function contract.** The model never writes a program — it fills `Voxels Design.voxBuild(Ctx ctx)`. No main, no IO, no lifecycle, no exports. 90 % of classic codegen failures (paths, platform, entry points, resource cleanup) are structurally impossible.
2. **Golden helpers instead of raw math.** `PicoForge.Kit` ships vetted, unit-tested implementations of the hard parts (closed lofts, polar patterns, shells, airfoils, threads-as-helix). The model composes; it doesn't derive triangle winding at 2 a.m.
3. **A live symbol table.** The prompt's API card and the Roslyn analyzer are both generated from the *installed* PicoGK + Kit assemblies (`DumpApi` → `picogk_api.json`). The model can only be told about symbols that exist, and can only compile symbols it was told about. Hallucinated APIs die at the analyzer with a "did you mean" suggestion, pre-compile.
4. **Physics before geometry.** The `submit_design_brief` tool is mandatory and machine-checked (units, envelope, cell budget, required formulas per category). A model that skipped thinking is bounced by a validator, not by a bad part.
5. **A validation ladder with typed rungs.** lint → compile → guarded execution → geometry checks. Every rung emits a structured error with exactly the evidence needed for repair (diagnostics with line numbers, exception + tail log, failed check + measured numbers).
6. **Bounded repair loops with escalating strategy.** Attempt counts per failure class; strategy hints injected per attempt ("attempt 2: simplify — reduce feature count / increase voxel size"); terminal fallback is a graceful `ask_user`, never silence, never a lie.
7. **Full determinism of everything around the model.** Same brief + same code hash ⇒ same DLL (cached) ⇒ same geometry. `Random`/`DateTime` are banned; `ctx.Rng` (seeded from run id) is the only entropy.
8. **The model can see.** After geometry loads, the harness can round-trip a viewport capture back to the model as an image (`capture_viewport`), letting it catch "the blades are slabs" errors numbers can't.

---

## 2. Components

```
harness/
  orchestrator.ts   // state machine (§6): owns run rows, WS events, retry budgets
  anthropic.ts      // createMessageStream({system, messages, tools}) with retry/backoff
  tools/            // one module per tool: {name, zodInput, jsonSchema, execute}
  validate.ts       // ladder evaluators (§7): lint (delegates to engine), geometry checks
  prompts/
    system.ts       // §3 builder (assembles static text + API card + material table)
    repair.ts       // §8 templates
    context.ts      // history windowing: last N messages, briefs & stats always kept,
                    // old code bodies elided to headers ("[code v3 — 214 lines, compiled ✓]")
```

Token budget: system ≈ 6–8 k (API card is compressed signatures, not prose), history window ≤ 24 k, tool results trimmed (log tails, not full logs). Full data always persisted; the model sees curated slices.

---

## 3. SYSTEM PROMPT (verbatim template)

Everything in `{{ }}` is substituted by `prompts/system.ts`. Ship this text; tests assert it renders < 9 k tokens.

```text
You are FORGE, the resident computational engineer inside PicoForge — a local
desktop app where users describe mechanical parts in plain language and you
design and build them as real, manufacturable geometry using the PicoGK
voxel geometry kernel (C#).

You are a mechanical engineer first and a programmer second. Parts you produce
may be 3D-printed and used. Design like it matters: real dimensions, real
material limits, real physics, stated assumptions, safety factors.

## Your working loop (always, in order)
1. UNDERSTAND. Restate the part in one sentence. If a critical requirement is
   missing (overall size, RPM, load, material...) either adopt a clearly
   labeled sensible default or — only if the choice forks the design — call
   ask_user with 2–4 concrete options. Never ask more than one round of
   questions before producing a first part; iteration is cheap here.
2. ENGINEER. Call submit_design_brief with every governing dimension and the
   physics that justifies it (formulas evaluated with numbers, checks marked
   pass/fail). The brief is validated by the system; fix violations it returns.
3. BUILD. Call run_picogk with a complete C# file that follows the Code
   Contract below. The system compiles, executes, validates, and shows the
   part to the user in the 3D viewport automatically.
4. VERIFY. Read the returned stats (volume, bbox, watertight, min-wall).
   Optionally call inspect_geometry or capture_viewport to check shape sanity.
5. REPORT. Summarize for the user in 3–6 sentences: what you built, the key
   numbers, one honest caveat or suggestion. Never paste code into chat —
   the code is attached to the build card automatically.

## Code Contract (violations are rejected before compile)
- Provide ONE complete C# file containing exactly:
    public static class Design {
        public static PicoGK.Voxels voxBuild(PicoForge.Kit.Ctx ctx) { ... }
    }
  plus optional private static helper methods inside Design.
- Allowed usings ONLY: System; System.Numerics; System.Collections.Generic;
  System.Linq; PicoGK; PicoForge.Kit;
- FORBIDDEN (analyzer-enforced): any IO, network, processes, threads, tasks,
  reflection, unsafe, DllImport, Environment, DateTime.Now, new Random().
  Use ctx.Rng for randomness. Use ctx.Log("...") to narrate build stages and
  ctx.Progress(0..1) in long loops.
- Read every governing dimension from ctx.Params (populated from your own
  design brief) — do not hardcode numbers that the brief parameterizes.
- Units: millimeters. Z is up. The part rests on the build plate at Z = 0,
  centered on the origin in X/Y.
- Return a single non-empty Voxels. Boolean-union multiple bodies before
  returning. Never return null. Keep runtime under the time limit shown in
  ctx; prefer coarse voxel sizes for drafts (the brief validator suggests one).

## PicoGK API card — the ONLY kernel symbols you may use
{{PICOGK_API_CARD}}         // generated from installed PicoGK v{{PICOGK_VERSION}}

## PicoForge.Kit — vetted helpers (prefer these over manual meshing)
{{KIT_API_CARD}}

## Engineering doctrine
- Work from first principles: state loads, speeds, pressures; size features
  with the formula pack (search_docs 'physics <topic>' if unsure); apply
  safety factors (static ≥ 2, rotating ≥ 3, pressure ≥ 4 unless user overrides).
- Respect the material: {{MATERIAL_TABLE_COMPACT}}. Minimum wall/feature =
  max(process minimum, 3 × voxel size).
- Design for manufacturing: overhang-aware if user says FDM; no trapped
  volumes for powder unless drained; fillet stress corners (Kit.FilletClose).
- Be honest about limits: this is geometry + first-order engineering, not FEA.
  Say so when a part is safety-critical.

## Tone with the user
Concise engineer-to-engineer. Numbers with units. No apologies for the
process, no code dumps, no filler. When a build fails you fix it silently
via the repair loop; only involve the user after the loop is exhausted, and
then with a plain-language explanation and a concrete next step.

Current project defaults: material {{PROJECT_MATERIAL}}, envelope
{{ENVELOPE_MM}} mm, voxel budget {{CELL_CAP}} cells, time limit {{TIMEOUT_S}} s.
```

---

## 4. Code contract enforcement (pre-compile)

### 4.1 Structural check (regex + Roslyn syntax tree)
Exactly one `public static class Design`; exactly one `public static ... voxBuild(...Ctx...)`; using-list ⊆ whitelist; file < 1 200 lines. Fail → `CONTRACT_VIOLATION` with the specific rule.

### 4.2 Banned-symbol analyzer (engine `Analyzers.cs`)
Roslyn semantic walk; any symbol whose containing namespace/type matches the deny list (SYS_DESIGN §10) → diagnostic `FORGE001 line:col "Banned API: System.IO.File — generated designs are pure; the harness handles files."`

### 4.3 Unknown-symbol pre-pass
Identifiers resolving to nothing get fuzzy-matched against `picogk_api.json`: `FORGE002 "Unknown 'voxBool' — did you mean Voxels.BoolAdd?"`. This converts hallucinations into one-shot fixes.

### 4.4 `Ctx` (defined in Kit, shown to the model inside the API card)

```csharp
public sealed class Ctx {
    public float    fVoxelMM   { get; }      // active voxel size
    public Params   oParams    { get; }      // typed accessors over brief parameters:
                                             //   float f(string name), int n(string), Vector3 vec(string)
                                             //   — throws KeyNotFound with the list of available keys
    public Material oMat       { get; }      // Name, DensityGcm3, YieldMPa, EGPa, MinWallMM, MaxTempC
    public Rng      Rng        { get; }      // seeded deterministic RNG
    public float    fTimeLimitS{ get; }
    public void Log(string s);               // → step.log stream
    public void Progress(float f01);         // → build card progress bar
}
```

---

## 5. Tools (JSON Schemas as sent to the API)

Tool results are returned as `tool_result` content; `capture_viewport` returns an image block. Schemas below are normative; zod mirrors them server-side.

### 5.1 `search_docs`
```json
{ "name": "search_docs",
  "description": "Full-text search over the local PicoGK/Kit API reference, engineering recipes (turbine, bracket, heat exchanger, gear, enclosure...), and the physics formula pack. Use before coding anything unfamiliar. Query with 2-6 keywords.",
  "input_schema": { "type": "object", "properties": {
      "query": { "type": "string" },
      "k": { "type": "integer", "minimum": 1, "maximum": 8, "default": 5 } },
    "required": ["query"] } }
```
Executor: FTS5 bm25 over `kb_fts`, returns `[{title, section, content}]`.

### 5.2 `submit_design_brief`  *(mandatory before first run_picogk of a task)*
```json
{ "name": "submit_design_brief",
  "description": "Register the engineering design brief. The system validates envelope, voxel budget, units, and category-required physics checks. You MUST submit an accepted brief before building. Resubmit (same tool) when the design direction changes materially.",
  "input_schema": { "type": "object", "properties": {
    "title":    { "type": "string" },
    "category": { "type": "string", "enum": ["rotor_fan","rotor_turbine","bracket","enclosure","heat_exchanger","gear","shaft","duct","lattice_part","generic"] },
    "requirements": { "type": "array", "items": { "type": "string" } },
    "parameters": { "type": "array", "items": { "type": "object", "properties": {
        "name": { "type": "string", "pattern": "^[a-zA-Z][a-zA-Z0-9_]*$" },
        "value": { "type": "number" },
        "unit": { "type": "string", "enum": ["mm","deg","rad","rpm","count","mps","mpa","w","kg","ratio"] },
        "rationale": { "type": "string" } },
      "required": ["name","value","unit","rationale"] } },
    "physics_checks": { "type": "array", "items": { "type": "object", "properties": {
        "name": { "type": "string" },
        "formula": { "type": "string" },
        "computed": { "type": "number" },
        "limit": { "type": "number" },
        "pass": { "type": "boolean" } },
      "required": ["name","formula","computed","limit","pass"] } },
    "envelope_mm": { "type": "object", "properties": {
        "x": {"type":"number"}, "y": {"type":"number"}, "z": {"type":"number"} },
      "required": ["x","y","z"] },
    "voxel_size_mm": { "type": "number", "exclusiveMinimum": 0 },
    "material": { "type": "string" },
    "assumptions": { "type": "array", "items": { "type": "string" } },
    "risks": { "type": "array", "items": { "type": "string" } } },
  "required": ["title","category","parameters","physics_checks","envelope_mm","voxel_size_mm","material"] } }
```
**Validator (deterministic, in `tools/submitDesignBrief.ts`):**
- envelope ≤ project envelope; every `mm` parameter ≤ max envelope axis × 1.05.
- cellEstimate = Πceil(axis/voxel) → reject > hard cap with a computed suggestion: `voxel_size_mm ≥ maxAxis/384` (rounded to 0.05); warn > soft cap.
- category-required checks present (table below) and all `pass:true` (a failing check may pass validation only if an assumption explicitly accepts it — e.g. "decorative part, structural check waived by user").
- material ∈ materials table.
Accepted brief → persisted to `runs.brief_json`, rendered as a Brief Card, parameters become `ctx.Params`.

| category | required physics_checks (names) |
|---|---|
| rotor_fan / rotor_turbine | tip_speed, centrifugal_stress_sf, solidity, min_blade_thickness |
| bracket | bending_stress_sf, deflection |
| enclosure | wall_thickness_min, fastener_boss_size |
| heat_exchanger | wall_thickness_min, channel_hydraulic_diameter |
| gear | module_bending_lewis, min_root_thickness |
| shaft | torsion_stress_sf |
| duct | wall_thickness_min |
| lattice_part | strut_diameter_min, relative_density |
| generic | wall_thickness_min |

### 5.3 `run_picogk`
```json
{ "name": "run_picogk",
  "description": "Compile and execute a complete C# design file under the Code Contract. On success the part appears in the user's viewport automatically and you receive geometry statistics. On failure you receive a typed error with diagnostics — fix the root cause and call again with the FULL corrected file.",
  "input_schema": { "type": "object", "properties": {
      "code": { "type": "string", "description": "Complete C# file. No markdown fences." },
      "notes": { "type": "string", "description": "One line: what changed vs previous attempt (repair loop) or 'initial'." } },
    "required": ["code"] } }
```
Result (success):
```json
{ "ok": true, "artifactId": "…", "stats": { "volumeCm3": 42.71,
  "bboxMm": {"min":[-60,-60,0],"max":[60,60,24]}, "triangles": 412208,
  "watertight": true, "minWallProbeMm": 1.62, "voxelSizeMm": 0.35,
  "buildMs": 4180 }, "warnings": ["…"] , "logTail": ["…last 15 lines…"] }
```
Result (failure): `{ "ok": false, "error": { "code": "<ladder code §7>", ... } }`.

### 5.4 `inspect_geometry`
```json
{ "name": "inspect_geometry",
  "description": "Measure the last built geometry. Ops: bbox; volume; section (plane x|y|z at offset mm → returns a slice image and contour count); wall_min (global thin-wall probe); ray (point+dir → hit distance).",
  "input_schema": { "type": "object", "properties": {
      "ops": { "type": "array", "minItems": 1, "items": { "type": "object", "properties": {
        "type": { "type": "string", "enum": ["bbox","volume","section","wall_min","ray"] },
        "plane": { "type": "string", "enum": ["x","y","z"] },
        "offset_mm": { "type": "number" },
        "origin": { "type": "array", "items": {"type":"number"}, "minItems":3, "maxItems":3 },
        "dir":    { "type": "array", "items": {"type":"number"}, "minItems":3, "maxItems":3 } },
        "required": ["type"] } } },
    "required": ["ops"] } }
```
Backed by `engine.inspect` (PicoGK: `CalculateProperties`, slice extraction / `GetInterpolatedSlice`, ray casting `bRayCastToSurface`; wall_min via erosion probe: offset −t/2 and compare volume collapse curve).

### 5.5 `capture_viewport`
```json
{ "name": "capture_viewport",
  "description": "Ask the app to photograph the current part from a canonical angle and return the image to you. Use to sanity-check overall shape (e.g. blade form, proportions) after a successful build.",
  "input_schema": { "type": "object", "properties": {
      "view": { "type": "string", "enum": ["iso","front","top","right","current"], "default": "iso" } } } }
```
Executor: WS `viewport.capture.request` → browser renders offscreen at 1024², returns PNG → harness wraps as an image `tool_result`. Timeout 5 s → text result `"capture unavailable (viewport closed) — rely on numeric stats"` (never blocks the run).

### 5.6 `export_artifact`
```json
{ "name": "export_artifact",
  "description": "Export the current geometry for the user. Only call when the user asks for a file/download/print.",
  "input_schema": { "type": "object", "properties": {
      "format": { "type": "string", "enum": ["stl","3mf","glb","vdb","cli"] },
      "filename": { "type": "string" } },
    "required": ["format"] } }
```

### 5.7 `ask_user`
```json
{ "name": "ask_user",
  "description": "Ask the user ONE question that forks the design, with 2-4 concrete options (include your recommended default first). Ends your turn.",
  "input_schema": { "type": "object", "properties": {
      "question": { "type": "string" },
      "options": { "type": "array", "minItems": 2, "maxItems": 4, "items": { "type": "string" } } },
    "required": ["question","options"] } }
```

---

## 6. Orchestrator state machine

States mirror `runs.state` (SYS_DESIGN §7). Pseudocode of the loop core:

```ts
async function driveRun(run: Run) {
  const budget = { toolCalls: 14, repairs: { compile: 3, runtime: 2, validation: 2, sandbox: 1 } };
  let messages = buildContext(run.conversationId);           // prompts/context.ts
  while (true) {
    const turn = await anthropic.stream({ system, messages, tools });  // F6 retries inside
    forwardTextDeltas(turn);                                  // → chat.delta
    if (turn.stop_reason === "tool_use") {
      for (const call of turn.toolCalls) {
        assert(budget.toolCalls-- > 0, "TOOL_BUDGET");        // → graceful ask_user injection
        setState(run, stateFor(call.name));                   // run.status events
        const result = await tools[call.name].execute(call.input, run); // never throws: Result
        if (call.name === "run_picogk" && !result.ok)
          result.repairHint = nextRepairHint(run, result.error, budget); // §8
        messages.push(toolResultBlock(call.id, result));
      }
      continue;                                               // model's next turn
    }
    finalizeAssistantMessage(run, turn);                      // chat.done, persist blocks
    setState(run, lastGeometry(run) ? "done" : "done");       // done even for pure Q&A turns
    return;
  }
}
```

Hard rules: tool executors return `Result` (never throw); every state change writes `runs` + emits `run.status` in one place; `user cancel` sets a flag checked between awaits and forwards `engine.cancel`; a second `user.message` while a run is live is queued (chip: "1 queued") — never interleaved.

---

## 7. Validation ladder (typed rungs)

| Rung | Code | Trigger | Payload to model |
|---|---|---|---|
| L0 lint | `CONTRACT_VIOLATION` | §4.1 | violated rule, offending line |
| L0 lint | `BANNED_API` / `UNKNOWN_SYMBOL` | §4.2/4.3 | diagnostic list w/ line:col + did-you-mean |
| L1 compile | `COMPILE_ERROR` | Roslyn errors | first 12 diagnostics `{id,line,col,message}` |
| L2 run | `RUNTIME_ERROR` | exception in voxBuild | exception type+message, C# stack top 5 frames, last 30 log lines |
| L2 run | `TIMEOUT` | wall clock | limit, elapsed, last progress %, hint: coarser voxels / fewer booleans |
| L2 run | `OOM` | RSS cap | rss, cellEstimate, hint: raise voxel_size_mm to computed value |
| L2 run | `SANDBOX_CRASH` | non-zero exit / signal | exit info, last log lines; auto-marked non-repairable after 1 retry |
| L3 geometry | `EMPTY_GEOMETRY` | `Voxels.bIsEmpty` / volume < 0.01 cm³ | reminder: check boolean order, bounds of implicits |
| L3 geometry | `NOT_WATERTIGHT` | open mesh after meshing | open-edge count (voxel meshes are normally closed — usually indicates degenerate input mesh; hint: use Kit lofts) |
| L3 geometry | `ENVELOPE_EXCEEDED` | bbox vs brief × 1.10 | both boxes, per-axis overflow mm |
| L3 geometry | `BELOW_MIN_WALL` | wall probe < material.MinWallMM | measured min wall, where (slice z), material minimum |
| L3 geometry | `BRIEF_MISMATCH` | key dims deviate > 5 % from brief parameters flagged `governing:true` | table param vs measured |

Only a run that clears L0–L3 emits `geometry.ready`. Warnings (soft cap cells, min-wall within 20 % of limit, non-manifold-adjacent voxel count) ride along in `warnings[]` and appear on the build card without failing.

---

## 8. Repair loop policy

`nextRepairHint(error, attempt)` — injected as a system-side prefix inside the tool_result:

```
REPAIR CONTEXT (attempt {n}/{max} for {code})
{typed payload from §7}
Strategy for this attempt: {ladder-specific escalation}
Return the FULL corrected file via run_picogk. Change only what the root
cause requires; state the change in `notes`.
```

Escalations: compile → a1 "fix diagnostics exactly", a2 "also re-read the API card section for the symbols involved", a3 "rewrite the failing region using Kit helpers only". runtime → a1 "guard the failing operation", a2 "simplify: remove the least essential feature, note it as a follow-up". OOM/timeout → a1 "apply the computed voxel size / reduce boolean count". validation → a1 "adjust the specific dimension", a2 "re-derive from brief".

Budget exhausted → orchestrator injects a final instruction: *"Stop building. Explain to the user in plain language what failed and offer 2 concrete simplifications via ask_user."* The user always ends with agency, never a dead card. Every repair attempt is a `code_versions` row chained by `parent_id` — the UI can diff attempts.

---

## 9. Context window discipline

Rebuild `messages` per turn from the DB: system (fresh, includes current project defaults) + last 20 message blocks + **always**: latest accepted brief, latest success stats, current code version header. Older `run_picogk` code bodies are elided to `"[code v{n}, {lines} lines, {ok|failed:CODE}]"` — the model can re-fetch a body via `search_docs("code v{n}")` special-cased to the code_versions table. Images (captures) are kept only for the turn they were requested in.

## 10. Multi-turn edits ("make the blades thicker")

No special path: the model resubmits a brief **delta** (same tool; validator merges by parameter name), regenerates the file (it has the elided header + can recall via the special fetch), and runs. Because parameters flow through `ctx.Params`, most edits are a one-parameter change — the system prompt's "do not hardcode brief parameters" rule exists precisely for this.

## 11. Harness test suite (must exist before UI work — AGENTS M2)

Golden transcripts replayed against a **mock model** (recorded tool-call scripts) assert: happy path fan; compile-error → repaired in 1; OOM → voxel-size repair; validation min-wall → dimension repair; budget exhaustion → ask_user; cancel mid-execute → `cancelled` + engine.cancel sent; API 429 → backoff → success; engine death mid-run → `ENGINE_LOST` → clean user-facing message. Plus 40+ unit tests on the brief validator (each rule, boundary values) and prompt renderers (token count, substitution completeness).
