// server/harness/tools/exportArtifact.ts — tool 5.6
// LLM_HARNESS §5.6: export geometry for user (STL, 3MF, GLB, VDB, CLI)

import { err, makeDef, ok, type RunCtx, type ToolModule, z } from "./_base.ts";

const zodInput = z.object({
  format: z.enum(["stl", "3mf", "glb", "vdb", "cli"]),
  filename: z.string().max(128).optional(),
});

type Input = z.infer<typeof zodInput>;

const jsonSchema = {
  type: "object",
  properties: {
    format: { type: "string", enum: ["stl", "3mf", "glb", "vdb", "cli"] },
    filename: { type: "string" },
  },
  required: ["format"],
};

export const exportArtifactTool: ToolModule<Input> = {
  name: "export_artifact",
  description:
    "Export the current geometry for the user. Only call when the user asks for a file/download/print.",
  zodInput,
  jsonSchema,
  def: makeDef(
    "export_artifact",
    "Export the current geometry for the user. Only call when the user asks for a file/download/print.",
    jsonSchema,
  ),

  async execute(input, ctx: RunCtx) {
    try {
      const parsed = zodInput.safeParse(input);
      if (!parsed.success) {
        return err(new Error(`export_artifact validation: ${parsed.error.message}`));
      }
      const { format, filename } = parsed.data;

      if (!ctx.lastArtifactId) {
        return ok({ error: "No geometry to export — run run_picogk first" });
      }

      const defaultName = filename ?? `part_${ctx.runId.slice(-8)}.${format}`;

      if (!ctx.engineClient) {
        return ok({ stub: true, message: `Would export ${defaultName} (engine not wired)` });
      }

      const engine = ctx.engineClient as {
        export(
          artifactId: string,
          format: string,
          filename: string,
        ): Promise<{ ok: boolean; value?: { downloadUrl: string }; error?: Error }>;
      };

      const result = await engine.export(ctx.lastArtifactId, format, defaultName);
      if (!result.ok) {
        return ok({ error: `Export failed: ${result.error?.message ?? "unknown"}` });
      }

      return ok({
        filename: defaultName,
        format,
        downloadUrl: result.value?.downloadUrl,
        message: `Ready: ${defaultName}`,
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  },
};
