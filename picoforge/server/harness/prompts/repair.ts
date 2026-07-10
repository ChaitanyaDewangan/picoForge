// server/harness/prompts/repair.ts — LLM_HARNESS §8 repair hint injector
// "REPAIR CONTEXT (attempt {n}/{max} for {code}) ... Strategy ..."

import { makeLogger } from "../../log.ts";

const log = makeLogger("harness.repair");

// ─── Repair budgets per error class ──────────────────────────────────────────

export const REPAIR_BUDGETS: Record<string, number> = {
  CONTRACT_VIOLATION: 3,
  BANNED_API:         3,
  UNKNOWN_SYMBOL:     3,
  COMPILE_ERROR:      3,
  RUNTIME_ERROR:      2,
  TIMEOUT:            2,
  OOM:                2,
  SANDBOX_CRASH:      1,
  EMPTY_GEOMETRY:     2,
  NOT_WATERTIGHT:     2,
  ENVELOPE_EXCEEDED:  2,
  BELOW_MIN_WALL:     2,
  BRIEF_MISMATCH:     2,
};

// ─── Per-attempt strategy text per LLM_HARNESS §8 ────────────────────────────

const STRATEGIES: Record<string, string[]> = {
  CONTRACT_VIOLATION: [
    "Fix the listed contract rule exactly. Your file must have exactly one `public static class Design` with `public static PicoGK.Voxels voxBuild(PicoForge.Kit.Ctx ctx)`.",
    "Remove all forbidden usings and ensure the file is under 1200 lines.",
    "Rewrite using only the required class structure and Kit helpers.",
  ],
  BANNED_API: [
    "Remove the banned API call identified in the diagnostics. Use the provided Kit helper or a pure expression instead.",
    "Check the full diagnostic list; replace every banned namespace symbol. Kit.voxCylinder, Kit.voxSphere etc. cover most construction needs.",
    "Rewrite the offending region using only PicoGK and PicoForge.Kit — no System.IO, System.Threading, System.Net.",
  ],
  UNKNOWN_SYMBOL: [
    "Replace the unknown symbol with the 'did you mean' suggestion from the diagnostic. Check the API card in the system prompt.",
    "Search the API card for the correct method. Prefer Kit helpers over raw PicoGK when available.",
    "Rewrite the failing region using only Kit helpers listed in the API card.",
  ],
  COMPILE_ERROR: [
    "Fix the diagnostics exactly — each one states the line and column. Do not change what the error does not require.",
    "Re-read the API card section for the symbols involved; the method signatures shown are exact.",
    "Rewrite the failing region using Kit helpers only — they have simpler, well-typed signatures.",
  ],
  RUNTIME_ERROR: [
    "Guard the failing operation: check that input vectors are non-zero, that radii are positive, that the polygon has ≥ 3 points before calling geometry functions.",
    "Simplify: remove the least essential feature and note it as a follow-up in `notes`. Stability over completeness.",
  ],
  TIMEOUT: [
    "Apply the suggested voxel_size_mm from the error payload. Reduce the boolean count: use a single BoolAdd/BoolSubtract per feature family, not one per element.",
    "Reduce feature count to the 3–4 most structurally significant. Use the Kit axial rotor for blade arrays instead of manual loops.",
  ],
  OOM: [
    "Apply the computed voxel_size_mm from the error payload. Reduce simultaneous Voxels objects — do not hold the intermediate voxels after the boolean is done.",
    "Reduce envelope and re-derive voxel_size_mm ≥ maxAxis/384.",
  ],
  SANDBOX_CRASH: [
    "The sandbox crashed unexpectedly. Simplify the design significantly — reduce lattice density, remove the most complex feature, and retry.",
  ],
  EMPTY_GEOMETRY: [
    "The build returned an empty Voxels. Check: (1) boolean subtraction did not eat the entire shape, (2) your lattice beams have positive radius, (3) implicit bounds contain the shape, (4) revolved profile is not degenerate.",
    "Rebuild from primitives with Kit helpers — Kit.voxBox/Sphere/Cylinder always produce non-empty results for valid inputs.",
  ],
  NOT_WATERTIGHT: [
    "The mesh has open edges — usually a degenerate input mesh. Replace hand-rolled Mesh construction with Kit.mshLoft or Kit.voxExtrudeZ which always produce closed surfaces.",
    "Use Kit boolean operations on Voxels only; avoid manual triangle winding.",
  ],
  ENVELOPE_EXCEEDED: [
    "Scale the geometry to fit within the envelope dimensions from your brief. The per-axis overflows are shown in the error.",
    "Re-derive the governing dimensions from the brief parameters via ctx.Params to ensure they match.",
  ],
  BELOW_MIN_WALL: [
    "Increase the wall thickness at the reported location to at least the material minimum shown in the error. Apply Kit.FilletClose to smooth thin edges.",
    "Re-derive the wall thickness from the brief's `min_wall` parameter, not a hardcoded value.",
  ],
  BRIEF_MISMATCH: [
    "Align the geometry dimensions with the brief parameters. Read the governing dimensions from ctx.Params — do not hardcode values the brief already defines.",
    "Re-derive all key dimensions from ctx.Params and verify the bbox matches the brief envelope.",
  ],
};

export interface RepairCtx {
  errorCode: string;
  attempt: number;           // 1-indexed
  payload: unknown;          // typed error payload from §7
}

/**
 * Build the repair hint string to prepend inside the tool_result block.
 * LLM_HARNESS §8.
 */
export function buildRepairHint(ctx: RepairCtx): string {
  const max = REPAIR_BUDGETS[ctx.errorCode] ?? 2;
  const strategies = STRATEGIES[ctx.errorCode] ?? ["Fix the root cause and return the full corrected file."];
  const strategy = strategies[Math.min(ctx.attempt - 1, strategies.length - 1)];

  const payloadText = typeof ctx.payload === "string"
    ? ctx.payload
    : JSON.stringify(ctx.payload, null, 2);

  return [
    `REPAIR CONTEXT (attempt ${ctx.attempt}/${max} for ${ctx.errorCode})`,
    payloadText,
    `Strategy for this attempt: ${strategy}`,
    "Return the FULL corrected file via run_picogk. Change only what the root cause requires; state the change in `notes`.",
  ].join("\n");
}

/**
 * Build the budget-exhausted injection (final message before ask_user).
 */
export function buildBudgetExhaustedInstruction(errorCode: string): string {
  return (
    `Stop building. The repair budget for ${errorCode} is exhausted after the maximum number of attempts. ` +
    `Explain to the user in plain language what failed and offer 2 concrete simplifications via ask_user. ` +
    `The user always ends with agency.`
  );
}

export function isBudgetExhausted(errorCode: string, attempt: number): boolean {
  const max = REPAIR_BUDGETS[errorCode] ?? 2;
  return attempt > max;
}
