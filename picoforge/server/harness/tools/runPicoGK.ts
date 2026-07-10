// server/harness/tools/runPicoGK.ts — tool 5.3
// LLM_HARNESS §5.3: compile + execute C# design, return typed ladder result

import { z, ok, err, makeDef, type RunCtx, type ToolModule } from "./_base.ts";
import { validateBrief } from "./submitDesignBrief.ts";

const zodInput = z.object({
  code: z.string().min(10).max(200_000),
  notes: z.string().default("initial"),
});

type Input = z.infer<typeof zodInput>;

const jsonSchema = {
  type: "object",
  properties: {
    code: { type: "string", description: "Complete C# file. No markdown fences." },
    notes: { type: "string", description: "One line: what changed vs previous attempt (repair loop) or 'initial'." },
  },
  required: ["code"],
};

// ─── L0 Lint (§4.1) ─────────────────────────────────────────────────────────

const ALLOWED_USINGS = new Set([
  "System",
  "System.Numerics",
  "System.Collections.Generic",
  "System.Linq",
  "PicoGK",
  "PicoForge.Kit",
]);

function lintContract(code: string): string[] {
  const violations: string[] = [];

  // Exactly one public static class Design
  const classMatches = [...code.matchAll(/public\s+static\s+class\s+(\w+)/g)];
  if (classMatches.length !== 1 || classMatches[0][1] !== "Design") {
    violations.push("Must have exactly one 'public static class Design'. Found: " +
      (classMatches.length === 0 ? "none" : classMatches.map(m => m[1]).join(", ")));
  }

  // Exactly one voxBuild method matching signature
  const voxBuildMatch = /public\s+static\s+(?:PicoGK\.)?Voxels\s+voxBuild\s*\(\s*(?:PicoForge\.Kit\.)?Ctx\s+\w+\s*\)/.test(code);
  if (!voxBuildMatch) {
    violations.push("Missing 'public static PicoGK.Voxels voxBuild(PicoForge.Kit.Ctx ctx)' method");
  }

  // File length
  const lines = code.split("\n").length;
  if (lines > 1200) {
    violations.push(`File exceeds 1200 lines (${lines} lines). Split into private static helpers within Design.`);
  }

  // Using whitelist
  const usingMatches = [...code.matchAll(/^using\s+([A-Za-z.]+)\s*;/gm)];
  for (const m of usingMatches) {
    const ns = m[1];
    if (!ALLOWED_USINGS.has(ns)) {
      violations.push(`Forbidden using: "${ns}". Allowed: ${[...ALLOWED_USINGS].join(", ")}`);
    }
  }

  return violations;
}

// ─── Tool ─────────────────────────────────────────────────────────────────────

export const runPicoGKTool: ToolModule<Input> = {
  name: "run_picogk",
  description:
    "Compile and execute a complete C# design file under the Code Contract. On success the part appears in the user's viewport automatically and you receive geometry statistics. On failure you receive a typed error with diagnostics — fix the root cause and call again with the FULL corrected file.",
  zodInput,
  jsonSchema,
  def: makeDef("run_picogk",
    "Compile and execute a complete C# design file under the Code Contract. On success the part appears in the user's viewport automatically and you receive geometry statistics. On failure you receive a typed error with diagnostics — fix the root cause and call again with the FULL corrected file.",
    jsonSchema,
  ),

  async execute(input, ctx: RunCtx) {
    try {
      const parsed = zodInput.safeParse(input);
      if (!parsed.success) return err(new Error(`run_picogk validation: ${parsed.error.message}`));
      const { code, notes } = parsed.data;

      // L0 lint — contract checks
      const lintViolations = lintContract(code);
      if (lintViolations.length > 0) {
        return ok({
          ok: false,
          error: { code: "CONTRACT_VIOLATION", violations: lintViolations },
        });
      }

      // Engine stub (M3 wires the real engine client)
      if (!ctx.engineClient) {
        return ok({
          ok: false,
          error: { code: "ENGINE_NOT_READY", detail: "Engine not connected — M3 wires this" },
        });
      }

      const engine = ctx.engineClient as {
        compile(code: string, codeId?: string): Promise<{ ok: boolean; value?: unknown; error?: Error }>;
        run(params: unknown): Promise<{ ok: boolean; value?: unknown; error?: Error }>;
      };

      // L1: Roslyn compile
      const codeId = `run-${ctx.runId}`;
      const compileResult = await engine.compile(code, codeId);
      if (!compileResult.ok) {
        return ok({ ok: false, error: { code: "COMPILE_ERROR", ...(compileResult as { error?: unknown }).error } });
      }

      // L2: Execute
      const runResult = await engine.run({
        codeId,
        runId: ctx.runId,
        params: {}, // from brief — wired in M3
        exports: ["stl"],
        outDir: `./runs/${ctx.runId}`,
      });

      if (!runResult.ok) {
        return ok({ ok: false, error: (runResult as { error?: unknown }).error });
      }

      const stats = (runResult as { value?: { stats?: unknown } }).value?.stats;

      // L3: Geometry checks — done inside Runner.cs; stats carry the result
      // Store artifact id for later tools
      ctx.lastArtifactId = ctx.runId;

      return ok({
        ok: true,
        artifactId: ctx.runId,
        notes,
        stats,
        logTail: [],
        warnings: [],
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  },
};
