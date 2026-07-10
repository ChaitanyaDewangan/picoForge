// server/harness/tools/searchDocs.ts — tool 5.1
// LLM_HARNESS §5.1: FTS5 bm25 over kb_fts, returns [{title, section, content}]

import { err, makeDef, ok, type RunCtx, type ToolModule, z } from "./_base.ts";

const zodInput = z.object({
  query: z.string().min(1).max(512),
  k: z.number().int().min(1).max(8).default(5),
});

type Input = z.infer<typeof zodInput>;

const jsonSchema = {
  type: "object",
  properties: {
    query: { type: "string" },
    k: { type: "integer", minimum: 1, maximum: 8, default: 5 },
  },
  required: ["query"],
};

export const searchDocsTool: ToolModule<Input> = {
  name: "search_docs",
  description:
    "Full-text search over the local PicoGK/Kit API reference, engineering recipes (turbine, bracket, heat exchanger, gear, enclosure...), and the physics formula pack. Use before coding anything unfamiliar. Query with 2-6 keywords.",
  zodInput,
  jsonSchema,
  def: makeDef(
    "search_docs",
    "Full-text search over the local PicoGK/Kit API reference, engineering recipes (turbine, bracket, heat exchanger, gear, enclosure...), and the physics formula pack. Use before coding anything unfamiliar. Query with 2-6 keywords.",
    jsonSchema,
  ),

  async execute(input, ctx: RunCtx) {
    try {
      const parsed = zodInput.safeParse(input);
      if (!parsed.success) return err(new Error(`search_docs validation: ${parsed.error.message}`));
      const { query, k } = parsed.data;

      // M3 will inject the DB; stub returns empty in headless tests
      if (!ctx.db) {
        return ok([{
          title: "stub",
          section: "stub",
          content: `[search_docs stub — DB not wired: "${query}"]`,
        }]);
      }

      // DB will be wired in M3: ctx.db.searchKb(query, k)
      const rows = await (ctx.db as {
        searchKb(
          q: string,
          k: number,
        ): Promise<{ title: string; section: string; content: string }[]>;
      })
        .searchKb(query, k);
      return ok(rows);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  },
};
