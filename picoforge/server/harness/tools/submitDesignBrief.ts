// server/harness/tools/submitDesignBrief.ts — tool 5.2
// LLM_HARNESS §5.2: mandatory before first run_picogk; full deterministic validator

import { err, makeDef, ok, type RunCtx, type ToolModule, z } from "./_base.ts";

// ─── Zod schema (mirrors JSON schema exactly) ─────────────────────────────────

const parameterSchema = z.object({
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  value: z.number(),
  unit: z.enum(["mm", "deg", "rad", "rpm", "count", "mps", "mpa", "w", "kg", "ratio"]),
  rationale: z.string(),
});

const physicsCheckSchema = z.object({
  name: z.string(),
  formula: z.string(),
  computed: z.number(),
  limit: z.number(),
  pass: z.boolean(),
});

export const CATEGORIES = [
  "rotor_fan",
  "rotor_turbine",
  "bracket",
  "enclosure",
  "heat_exchanger",
  "gear",
  "shaft",
  "duct",
  "lattice_part",
  "generic",
] as const;

// Required physics check names per category — LLM_HARNESS §5.2 table
const REQUIRED_CHECKS: Record<typeof CATEGORIES[number], string[]> = {
  rotor_fan: ["tip_speed", "centrifugal_stress_sf", "solidity", "min_blade_thickness"],
  rotor_turbine: ["tip_speed", "centrifugal_stress_sf", "solidity", "min_blade_thickness"],
  bracket: ["bending_stress_sf", "deflection"],
  enclosure: ["wall_thickness_min", "fastener_boss_size"],
  heat_exchanger: ["wall_thickness_min", "channel_hydraulic_diameter"],
  gear: ["module_bending_lewis", "min_root_thickness"],
  shaft: ["torsion_stress_sf"],
  duct: ["wall_thickness_min"],
  lattice_part: ["strut_diameter_min", "relative_density"],
  generic: ["wall_thickness_min"],
};

const MATERIALS = new Set(["PLA", "PETG", "ABS", "PA12", "Resin", "Al6061-T6", "SS316L"]);

const zodInput = z.object({
  title: z.string().min(1).max(120),
  category: z.enum(CATEGORIES),
  requirements: z.array(z.string()).default([]),
  parameters: z.array(parameterSchema).min(1),
  physics_checks: z.array(physicsCheckSchema).min(1),
  envelope_mm: z.object({
    x: z.number().positive(),
    y: z.number().positive(),
    z: z.number().positive(),
  }),
  voxel_size_mm: z.number().positive(),
  material: z.string(),
  assumptions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
});

type Input = z.infer<typeof zodInput>;

const jsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    category: { type: "string", enum: [...CATEGORIES] },
    requirements: { type: "array", items: { type: "string" } },
    parameters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", pattern: "^[a-zA-Z][a-zA-Z0-9_]*$" },
          value: { type: "number" },
          unit: {
            type: "string",
            enum: ["mm", "deg", "rad", "rpm", "count", "mps", "mpa", "w", "kg", "ratio"],
          },
          rationale: { type: "string" },
        },
        required: ["name", "value", "unit", "rationale"],
      },
    },
    physics_checks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          formula: { type: "string" },
          computed: { type: "number" },
          limit: { type: "number" },
          pass: { type: "boolean" },
        },
        required: ["name", "formula", "computed", "limit", "pass"],
      },
    },
    envelope_mm: {
      type: "object",
      properties: { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } },
      required: ["x", "y", "z"],
    },
    voxel_size_mm: { type: "number", exclusiveMinimum: 0 },
    material: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
  },
  required: [
    "title",
    "category",
    "parameters",
    "physics_checks",
    "envelope_mm",
    "voxel_size_mm",
    "material",
  ],
};

// ─── Project limits (resolved from settings in M3; sane defaults here) ───────

const PROJECT_ENVELOPE_MM = { x: 400, y: 400, z: 400 };
const HARD_CELL_CAP = 1_500_000_000n;
const SOFT_CELL_CAP = 500_000_000n;

// ─── Validator ────────────────────────────────────────────────────────────────

export interface BriefValidationResult {
  ok: boolean;
  violations: string[];
  warnings: string[];
  cellEstimate: bigint;
  suggestedVoxelMm?: number;
}

export function validateBrief(input: Input): BriefValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  // 1. Material check
  if (!MATERIALS.has(input.material)) {
    violations.push(`material "${input.material}" unknown. Valid: ${[...MATERIALS].join(", ")}`);
  }

  // 2. Envelope check — each axis ≤ project envelope × 1.05
  const env = input.envelope_mm;
  const proj = PROJECT_ENVELOPE_MM;
  for (const ax of ["x", "y", "z"] as const) {
    if (env[ax] > proj[ax] * 1.05) {
      violations.push(
        `envelope_mm.${ax} (${env[ax]}) exceeds project max ${proj[ax]} mm × 1.05 = ${
          proj[ax] * 1.05
        }`,
      );
    }
  }

  // 3. Every mm parameter ≤ maxEnvelopeAxis × 1.05
  const maxAxis = Math.max(env.x, env.y, env.z);
  for (const p of input.parameters) {
    if (p.unit === "mm" && p.value > maxAxis * 1.05) {
      violations.push(
        `parameter "${p.name}" (${p.value} mm) exceeds max envelope axis ${maxAxis} mm × 1.05 = ${
          maxAxis * 1.05
        } mm`,
      );
    }
  }

  // 4. Cell budget estimate = Π ceil(axis / voxel)
  const vox = input.voxel_size_mm;
  const cells = BigInt(Math.ceil(env.x / vox)) *
    BigInt(Math.ceil(env.y / vox)) *
    BigInt(Math.ceil(env.z / vox));

  let suggestedVoxelMm: number | undefined;
  if (cells > HARD_CELL_CAP) {
    // suggest: voxel ≥ maxAxis / 384, rounded up to 0.05
    const minVox = Math.ceil((maxAxis / 384) / 0.05) * 0.05;
    suggestedVoxelMm = minVox;
    violations.push(
      `voxel budget ${cells.toLocaleString()} cells exceeds hard cap ${HARD_CELL_CAP.toLocaleString()}. ` +
        `Increase voxel_size_mm to ≥ ${minVox} mm`,
    );
  } else if (cells > SOFT_CELL_CAP) {
    warnings.push(
      `voxel budget ${cells.toLocaleString()} cells exceeds soft cap ${SOFT_CELL_CAP.toLocaleString()} — expect slow build`,
    );
  }

  // 5. Required physics checks for category
  const required = REQUIRED_CHECKS[input.category];
  const presentNames = new Set(input.physics_checks.map((c) => c.name));
  for (const r of required) {
    if (!presentNames.has(r)) {
      violations.push(`category "${input.category}" requires physics_check "${r}" — not present`);
    }
  }

  // 6. All checks must pass (or an assumption explicitly waives them)
  const assumptionText = input.assumptions.join(" ").toLowerCase();
  for (const c of input.physics_checks) {
    if (!c.pass) {
      const waived = assumptionText.includes("waived") || assumptionText.includes("decorative");
      if (!waived) {
        violations.push(
          `physics_check "${c.name}" has pass:false — fix the design or add an assumption explicitly waiving it`,
        );
      } else {
        warnings.push(`physics_check "${c.name}" waived by assumption`);
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    warnings,
    cellEstimate: cells,
    suggestedVoxelMm,
  };
}

// ─── Tool ─────────────────────────────────────────────────────────────────────

export const submitDesignBriefTool: ToolModule<Input> = {
  name: "submit_design_brief",
  description:
    "Register the engineering design brief. The system validates envelope, voxel budget, units, and category-required physics checks. You MUST submit an accepted brief before building. Resubmit (same tool) when the design direction changes materially.",
  zodInput,
  jsonSchema,
  def: makeDef(
    "submit_design_brief",
    "Register the engineering design brief. The system validates envelope, voxel budget, units, and category-required physics checks. You MUST submit an accepted brief before building. Resubmit (same tool) when the design direction changes materially.",
    jsonSchema,
  ),

  async execute(input, ctx: RunCtx) {
    try {
      const parsed = zodInput.safeParse(input);
      if (!parsed.success) {
        return err(new Error(`submit_design_brief validation: ${parsed.error.message}`));
      }
      const data = parsed.data;

      const validation = validateBrief(data);
      if (!validation.ok) {
        return ok({
          accepted: false,
          violations: validation.violations,
          warnings: validation.warnings,
          cellEstimate: validation.cellEstimate.toString(),
          suggestedVoxelMm: validation.suggestedVoxelMm,
        });
      }

      // Persist brief to run row (M3 DB wiring)
      if (ctx.db) {
        await (ctx.db as { upsertBrief(runId: string, brief: unknown): Promise<void> })
          .upsertBrief(ctx.runId, data);
      }

      return ok({
        accepted: true,
        warnings: validation.warnings,
        cellEstimate: validation.cellEstimate.toString(),
        paramCount: data.parameters.length,
        message:
          `Brief accepted: "${data.title}" (${data.category}, ${data.parameters.length} params, est. ${validation.cellEstimate.toLocaleString()} cells)`,
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  },
};
