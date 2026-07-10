// server/harness/tests/mockModel.ts — deterministic mock for golden transcript tests
// LLM_HARNESS §11: "Golden transcripts replayed against a mock model (recorded tool-call scripts)"
//
// Usage: create a MockModel with a script of turns. Each turn is either:
//   { text: string, tools?: never }           → end_turn with text
//   { tools: ToolCall[], text?: string }       → tool_use turn
//   { error: number }                          → simulated HTTP error (for retry tests)

import type { TurnResult } from "../anthropic.ts";
import { err, ok, type Result } from "../../domain/result.ts";

export interface MockToolCall {
  id: string;
  name: string;
  input: unknown;
}

export type MockTurn =
  | { text: string; tools?: undefined }
  | { tools: MockToolCall[]; text?: string }
  | { error: number; text?: undefined; tools?: undefined };

/**
 * A scripted replacement for createMessageStream.
 * Replay turns in order; after the script is exhausted every call returns a
 * plain end_turn with text "Script exhausted".
 */
export class MockModel {
  private _script: MockTurn[];
  private _idx = 0;
  /** Record of calls received: useful for assertions */
  readonly calls: Array<{
    messages: unknown[];
    toolNames: string[];
    turn: number;
  }> = [];

  constructor(script: MockTurn[]) {
    this._script = script;
  }

  /**
   * Drop-in replacement for createMessageStream.
   * Passed as the `streamFn` option to driveRunWith().
   */
  async stream(
    args: { messages: unknown[] },
    _callbacks?: unknown,
  ): Promise<Result<TurnResult, Error>> {
    await Promise.resolve(); // yield to event loop (realistic async)

    const turn = this._script[this._idx++];
    const callIdx = this._idx - 1;

    if (!turn) {
      this.calls.push({ messages: args.messages, toolNames: [], turn: callIdx });
      return ok({
        stopReason: "end_turn",
        textBlocks: ["Script exhausted"],
        toolCalls: [],
        inputTokens: 0,
        outputTokens: 0,
      });
    }

    if ("error" in turn) {
      // Simulate a retryable API error
      const e = Object.assign(new Error(`Mock HTTP ${turn.error}`), { status: turn.error });
      return err(e);
    }

    const toolNames = (turn.tools ?? []).map((t) => t.name);
    this.calls.push({ messages: args.messages, toolNames, turn: callIdx });

    if (turn.tools && turn.tools.length > 0) {
      return ok({
        stopReason: "tool_use",
        textBlocks: turn.text ? [turn.text] : [],
        toolCalls: turn.tools,
        inputTokens: 10,
        outputTokens: 50,
      });
    }

    return ok({
      stopReason: "end_turn",
      textBlocks: [turn.text ?? ""],
      toolCalls: [],
      inputTokens: 10,
      outputTokens: 50,
    });
  }

  get turnIndex(): number {
    return this._idx;
  }
}
