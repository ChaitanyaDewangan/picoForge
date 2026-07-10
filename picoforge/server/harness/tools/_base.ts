// server/harness/tools/_base.ts — shared types for all tool modules
// LLM_HARNESS §5: "one module per tool: {name, zodInput, jsonSchema, execute}"

import { z } from "npm:zod@^3.23.0";
import { ToolDefinition } from "../anthropic.ts";
import { ok, err, Result } from "../../domain/result.ts";

export type { ToolDefinition };
export { z, ok, err };
export type { Result };

/** Every run context the tools need (engine, db, ws hub refs). */
export interface RunCtx {
  runId: string;
  projectId: string;
  conversationId: string;
  signal: AbortSignal;
  // Injected by orchestrator before calling tools
  engineClient?: unknown;    // EngineClient from engine/client.ts — typed in M3
  db?: unknown;              // DB from db/db.ts — typed in M3
  wsHub?: unknown;           // WsHub from ws/hub.ts — typed in M4
  lastArtifactId?: string;   // set by run_picogk on success
}

/** Shape every tool module must export. */
export interface ToolModule<TInput> {
  name: string;
  description: string;
  zodInput: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  jsonSchema: ToolDefinition["input_schema"];
  execute(input: TInput, ctx: RunCtx): Promise<Result<unknown, Error>>;
  /** Assembled Anthropic-format tool definition. */
  readonly def: ToolDefinition;
}

/** Build the ToolDefinition from module fields (call at module bottom). */
export function makeDef(name: string, description: string, schema: ToolDefinition["input_schema"]): ToolDefinition {
  return { name, description, input_schema: schema };
}
