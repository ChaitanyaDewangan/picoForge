// server/harness/tools/captureViewport.ts — tool 5.5
// LLM_HARNESS §5.5: WS viewport.capture.request → PNG → image tool_result
// Timeout 5s → text fallback (never blocks the run)

import { z, ok, err, makeDef, type RunCtx, type ToolModule } from "./_base.ts";

const zodInput = z.object({
  view: z.enum(["iso", "front", "top", "right", "current"]).default("iso"),
});

type Input = z.infer<typeof zodInput>;

const jsonSchema = {
  type: "object",
  properties: {
    view: { type: "string", enum: ["iso", "front", "top", "right", "current"], default: "iso" },
  },
};

const CAPTURE_TIMEOUT_MS = 5_000;

export const captureViewportTool: ToolModule<Input> = {
  name: "capture_viewport",
  description:
    "Ask the app to photograph the current part from a canonical angle and return the image to you. Use to sanity-check overall shape (e.g. blade form, proportions) after a successful build.",
  zodInput,
  jsonSchema,
  def: makeDef("capture_viewport",
    "Ask the app to photograph the current part from a canonical angle and return the image to you. Use to sanity-check overall shape (e.g. blade form, proportions) after a successful build.",
    jsonSchema,
  ),

  async execute(input, ctx: RunCtx) {
    try {
      const parsed = zodInput.safeParse(input);
      if (!parsed.success) return err(new Error(`capture_viewport validation: ${parsed.error.message}`));
      const { view } = parsed.data;

      if (!ctx.wsHub) {
        // Headless / no viewport — graceful fallback per spec
        return ok([{ type: "text", text: "capture unavailable (viewport closed) — rely on numeric stats" }]);
      }

      const hub = ctx.wsHub as {
        requestCapture(conversationId: string, view: string, timeoutMs: number): Promise<string | null>;
      };

      const base64png = await hub.requestCapture(ctx.conversationId, view, CAPTURE_TIMEOUT_MS);

      if (!base64png) {
        return ok([{ type: "text", text: "capture unavailable (viewport closed) — rely on numeric stats" }]);
      }

      // Return as image block — orchestrator wraps in tool_result
      return ok([{
        type: "image",
        source: { type: "base64", media_type: "image/png", data: base64png },
      }]);
    } catch (e) {
      // Never propagate — always return graceful text fallback
      return ok([{ type: "text", text: "capture unavailable (viewport closed) — rely on numeric stats" }]);
    }
  },
};
