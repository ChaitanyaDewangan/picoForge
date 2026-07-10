// server/harness/tools/askUser.ts — tool 5.7
// LLM_HARNESS §5.7: ask ONE question with 2–4 options; terminates the model's turn

import { z, ok, err, makeDef, type RunCtx, type ToolModule } from "./_base.ts";

const zodInput = z.object({
  question: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).min(2).max(4),
});

type Input = z.infer<typeof zodInput>;

const jsonSchema = {
  type: "object",
  properties: {
    question: { type: "string" },
    options: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
  },
  required: ["question", "options"],
};

export const askUserTool: ToolModule<Input> = {
  name: "ask_user",
  description:
    "Ask the user ONE question that forks the design, with 2-4 concrete options (include your recommended default first). Ends your turn.",
  zodInput,
  jsonSchema,
  def: makeDef("ask_user",
    "Ask the user ONE question that forks the design, with 2-4 concrete options (include your recommended default first). Ends your turn.",
    jsonSchema,
  ),

  async execute(input, ctx: RunCtx) {
    try {
      const parsed = zodInput.safeParse(input);
      if (!parsed.success) return err(new Error(`ask_user validation: ${parsed.error.message}`));
      const { question, options } = parsed.data;

      // Emit ask_user event over WS so the UI renders option buttons
      if (ctx.wsHub) {
        await (ctx.wsHub as {
          sendToConversation(id: string, event: unknown): Promise<void>;
        }).sendToConversation(ctx.conversationId, {
          type: "ask_user",
          question,
          options,
          runId: ctx.runId,
        });
      }

      // Result tells orchestrator the turn is awaiting user input
      // The orchestrator sets run state to "awaiting_user"
      return ok({
        __askUser: true,
        question,
        options,
        message: "Waiting for user to select an option",
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  },
};
