// server/harness/prompts/system.ts — LLM_HARNESS §3 system prompt builder
// Assembles: verbatim template + API card substitution + material table
// Tests assert rendered output < 9 k tokens

import { makeLogger } from "../../log.ts";

const log = makeLogger("harness.prompts.system");

// ─── Compact material table ───────────────────────────────────────────────────

const MATERIAL_TABLE_COMPACT = "PLA(ρ=1.24 g/cm³,σy=45 MPa,E=3.5 GPa,wall≥1.0mm,max55°C) | " +
  "PETG(1.27,50,2.1,≥1.0,75°C) | " +
  "ABS(1.05,40,2.0,≥1.2,95°C) | " +
  "PA12(1.01,48,1.7,≥0.8,120°C) | " +
  "Resin(1.15,55,2.6,≥0.6,60°C) | " +
  "Al6061-T6(2.70,276,68.9,≥0.8,200°C) | " +
  "SS316L(8.00,205,193,≥0.5,400°C)";

// ─── Verbatim template §3 ─────────────────────────────────────────────────────

const TEMPLATE = `\
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
{{PICOGK_API_CARD}}

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
{{ENVELOPE_MM}} mm, voxel budget {{CELL_CAP}} cells, time limit {{TIMEOUT_S}} s.`;

// ─── API card compression ─────────────────────────────────────────────────────

interface ApiEntry {
  name: string;
  sig: string;
  doc?: string;
}
interface ApiType {
  name: string;
  namespace: string;
  members: ApiEntry[];
}
interface ApiManifest {
  types: ApiType[];
  picogkVersion?: string;
}

function buildApiCard(manifest: ApiManifest, namespace: string): string {
  const lines: string[] = [];
  for (const t of manifest.types) {
    if (t.namespace !== namespace) continue;
    lines.push(`### ${t.name}`);
    for (const m of t.members) {
      lines.push(`  ${m.sig}`);
    }
  }
  return lines.join("\n");
}

// ─── Public builder ──────────────────────────────────────────────────────────

export interface SystemPromptParams {
  picogkApiManifest?: ApiManifest;
  projectMaterial?: string;
  envelopeMm?: { x: number; y: number; z: number };
  cellCap?: number;
  timeoutS?: number;
}

export function buildSystemPrompt(params: SystemPromptParams = {}): string {
  const {
    picogkApiManifest,
    projectMaterial = "PETG",
    envelopeMm = { x: 300, y: 300, z: 200 },
    cellCap = 500_000_000,
    timeoutS = 120,
  } = params;

  const picogkCard = picogkApiManifest
    ? buildApiCard(picogkApiManifest, "PicoGK")
    : "(picogk_api.json not loaded — run DumpApi)";

  const kitCard = picogkApiManifest
    ? buildApiCard(picogkApiManifest, "PicoForge.Kit")
    : "(Kit API not loaded)";

  const envStr = `${envelopeMm.x} × ${envelopeMm.y} × ${envelopeMm.z}`;
  const cellStr = cellCap.toLocaleString();

  const prompt = TEMPLATE
    .replace("{{PICOGK_API_CARD}}", picogkCard)
    .replace("{{KIT_API_CARD}}", kitCard)
    .replace("{{MATERIAL_TABLE_COMPACT}}", MATERIAL_TABLE_COMPACT)
    .replace("{{PROJECT_MATERIAL}}", projectMaterial)
    .replace("{{ENVELOPE_MM}}", envStr)
    .replace("{{CELL_CAP}}", cellStr)
    .replace("{{TIMEOUT_S}}", String(timeoutS));

  // Approximate token count (rough: 4 chars/token)
  const approxTokens = Math.ceil(prompt.length / 4);
  if (approxTokens > 9000) {
    log.warn("System prompt exceeds 9k token budget", { approxTokens });
  }

  return prompt;
}

/** Estimate token count (rough: 4 chars per token) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
