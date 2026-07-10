// server/harness/orchestrator.ts — LLM_HARNESS §6 orchestrator state machine
// driveRun: tool budget, repair loop, cancel, queue, state emission

import { makeLogger } from "../log.ts";
import {
  type AnthropicMessage,
  createMessageStream,
  type StreamCallbacks,
  type ToolDefinition,
  type TurnResult,
} from "./anthropic.ts";
import { type Result } from "../domain/result.ts";
import { TOOL_MAP, TOOLS } from "./tools/index.ts";
import type { RunCtx } from "./tools/_base.ts";
import {
  buildBudgetExhaustedInstruction,
  buildRepairHint,
  isBudgetExhausted,
} from "./prompts/repair.ts";
import { buildContextMessages, type HistoryEntry } from "./prompts/context.ts";
import { buildSystemPrompt } from "./prompts/system.ts";

const log = makeLogger("harness.orchestrator");

// ─── Settings (overridden by DB settings in M3) ──────────────────────────────

const DEFAULT_SETTINGS = {
  model: "claude-sonnet-4-6",
  maxTokens: 8096,
  temperature: 0.7,
};

// ─── Tool budget ─────────────────────────────────────────────────────────────

const TOOL_CALL_BUDGET = 14; // LLM_HARNESS §6

// ─── Run state type ──────────────────────────────────────────────────────────

export type RunState =
  | "queued"
  | "understanding"
  | "briefing"
  | "building"
  | "inspecting"
  | "awaiting_user"
  | "done"
  | "failed"
  | "cancelled";

// ─── Callbacks injected by the server layer (M3 wires real versions) ─────────

export interface OrchestratorCallbacks {
  onStateChange?: (runId: string, state: RunState, detail?: unknown) => void;
  onTextDelta?: (runId: string, delta: string) => void;
  onGeometryReady?: (runId: string, artifactId: string, stats: unknown) => void;
  onError?: (runId: string, code: string, detail: unknown) => void;
}

// ─── Main driver ─────────────────────────────────────────────────────────────

/** Injectable stream function — defaults to real Anthropic client; tests inject mock */
export type StreamFn = (
  args: {
    model: string;
    maxTokens: number;
    temperature: number;
    system: string;
    messages: AnthropicMessage[];
    tools: ToolDefinition[];
    signal?: AbortSignal;
  },
  callbacks?: StreamCallbacks,
) => Promise<Result<TurnResult, Error>>;

export async function driveRun(
  {
    runId,
    projectId,
    conversationId,
    userMessage,
    history,
    signal,
    ctx: runCtxOverrides,
    callbacks,
    settings,
    streamFn,
  }: {
    runId: string;
    projectId: string;
    conversationId: string;
    userMessage: string;
    history: HistoryEntry[];
    signal: AbortSignal;
    ctx?: Partial<RunCtx>;
    callbacks?: OrchestratorCallbacks;
    settings?: Partial<typeof DEFAULT_SETTINGS>;
    /** Inject a mock stream function in tests; omit in production */
    streamFn?: StreamFn;
  },
): Promise<{ state: RunState }> {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  let toolCallsLeft = TOOL_CALL_BUDGET;

  // Repair attempt counters per error code
  const repairAttempts: Record<string, number> = {};

  // Build RunCtx
  const runCtx: RunCtx = {
    runId,
    projectId,
    conversationId,
    signal,
    ...runCtxOverrides,
  };

  // Tool definitions for the API
  const toolDefs: ToolDefinition[] = TOOLS.map((t) => t.def);

  const emit = (state: RunState, detail?: unknown) => {
    callbacks?.onStateChange?.(runId, state, detail);
    log.info("run state", { runId, state });
  };

  // Build messages from history + append user message
  const contextMessages = buildContextMessages(history, {});
  const messages: AnthropicMessage[] = [
    ...contextMessages,
    { role: "user", content: [{ type: "text", text: userMessage }] },
  ];

  const system = buildSystemPrompt();
  emit("understanding");

  // ─── Main loop ─────────────────────────────────────────────────────────────

  while (true) {
    if (signal.aborted) {
      emit("cancelled");
      return { state: "cancelled" };
    }

    const turnResult = await (streamFn ?? createMessageStream)(
      {
        model: s.model,
        maxTokens: s.maxTokens,
        temperature: s.temperature,
        system,
        messages,
        tools: toolDefs,
        signal,
      },
      {
        onTextDelta: (delta) => callbacks?.onTextDelta?.(runId, delta),
      },
    );

    if (!turnResult.ok) {
      const errMsg = turnResult.error.message;
      if (errMsg === "CANCELLED") {
        emit("cancelled");
        return { state: "cancelled" };
      }
      emit("failed", { code: "ANTHROPIC_ERROR", detail: errMsg });
      callbacks?.onError?.(runId, "ANTHROPIC_ERROR", errMsg);
      return { state: "failed" };
    }

    const turn = turnResult.value;

    // Append assistant message to history
    const assistantContent: AnthropicMessage["content"] = [];
    for (const text of turn.textBlocks) {
      assistantContent.push({ type: "text", text });
    }
    for (const tc of turn.toolCalls) {
      assistantContent.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
    }
    messages.push({ role: "assistant", content: assistantContent });

    if (turn.stopReason === "end_turn" || turn.toolCalls.length === 0) {
      emit("done");
      return { state: "done" };
    }

    // ─── Tool dispatch ───────────────────────────────────────────────────────

    const toolResultContent: AnthropicMessage["content"] = [];

    for (const call of turn.toolCalls) {
      if (signal.aborted) {
        emit("cancelled");
        return { state: "cancelled" };
      }

      // Budget check
      if (toolCallsLeft <= 0) {
        // Inject budget exhausted instruction
        const budgetMsg = buildBudgetExhaustedInstruction("TOOL_BUDGET");
        toolResultContent.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: [{ type: "text", text: budgetMsg }],
        });
        break;
      }
      toolCallsLeft--;

      // State transition based on tool
      const nextState: RunState = call.name === "submit_design_brief"
        ? "briefing"
        : call.name === "run_picogk"
        ? "building"
        : call.name === "inspect_geometry"
        ? "inspecting"
        : call.name === "capture_viewport"
        ? "inspecting"
        : call.name === "ask_user"
        ? "awaiting_user"
        : "understanding";
      emit(nextState);

      // Find and execute tool
      const tool = TOOL_MAP[call.name];
      if (!tool) {
        toolResultContent.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: [{ type: "text", text: `Unknown tool: ${call.name}` }],
        });
        continue;
      }

      // deno-lint-ignore no-explicit-any
      const result = await tool.execute(call.input as any, runCtx);
      let resultText: string;

      if (!result.ok) {
        resultText = JSON.stringify({ error: result.error.message });
      } else {
        const value = result.value as Record<string, unknown>;

        // Handle ask_user terminal
        if (value.__askUser) {
          toolResultContent.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: [{ type: "text", text: JSON.stringify(value) }],
          });
          messages.push({ role: "user", content: toolResultContent });
          emit("awaiting_user");
          return { state: "awaiting_user" };
        }

        // run_picogk repair loop
        if (call.name === "run_picogk" && value.ok === false) {
          const runError = value.error as { code?: string } | undefined;
          const errorCode = runError?.code ?? "UNKNOWN";
          repairAttempts[errorCode] = (repairAttempts[errorCode] ?? 0) + 1;

          if (isBudgetExhausted(errorCode, repairAttempts[errorCode])) {
            const exhaustedMsg = buildBudgetExhaustedInstruction(errorCode);
            resultText = exhaustedMsg;
          } else {
            const repairHint = buildRepairHint({
              errorCode,
              attempt: repairAttempts[errorCode],
              payload: runError,
            });
            resultText = repairHint;
          }
        } else if (call.name === "run_picogk" && value.ok === true) {
          // Success — reset repair counters, emit geometry ready
          for (const key of Object.keys(repairAttempts)) delete repairAttempts[key];
          callbacks?.onGeometryReady?.(runId, value.artifactId as string, value.stats);
          resultText = JSON.stringify(value);
        } else {
          resultText = JSON.stringify(value);
        }
      }

      toolResultContent.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: [{ type: "text", text: resultText }],
      });
    }

    // Append all tool results as a single user message
    if (toolResultContent.length > 0) {
      messages.push({ role: "user", content: toolResultContent });
    }

    // Continue to next model turn
  }
}
