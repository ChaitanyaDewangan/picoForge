// server/harness/anthropic.ts — Anthropic streaming client
// LLM_HARNESS §2: "createMessageStream with retry/backoff"
// AGENTS.md §3.11: verify shapes against https://docs.claude.com/en/api/overview

import Anthropic from "npm:@anthropic-ai/sdk@^0.54.0";
import { makeLogger } from "../log.ts";
import { err, ok, Result } from "../domain/result.ts";

const log = makeLogger("harness.anthropic");

// ─── Types (mirrors Anthropic SDK, pinned here so we can change SDK without ripple) ──────────

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: MessageContent[];
}

export type MessageContent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: ToolResultContent[] }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export type ToolResultContent =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface StreamCallbacks {
  onTextDelta?: (delta: string) => void;
  onInputJsonDelta?: (toolUseId: string, delta: string) => void;
}

export interface TurnResult {
  stopReason: "end_turn" | "tool_use" | "max_tokens";
  textBlocks: string[];
  toolCalls: Array<{ id: string; name: string; input: unknown }>;
  inputTokens: number;
  outputTokens: number;
}

// ─── Retry config ─────────────────────────────────────────────────────────────

const RETRYABLE = new Set([429, 529, 500, 503]);
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000] as const;
const MAX_ATTEMPTS = 6; // F6 per LLM_HARNESS §2

// ─── Client ──────────────────────────────────────────────────────────────────

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

/**
 * Stream one assistant turn with F6 retry/backoff on transient errors.
 * Returns a Result; never throws.
 */
export async function createMessageStream(
  {
    model,
    maxTokens,
    temperature,
    system,
    messages,
    tools,
    signal,
  }: {
    model: string;
    maxTokens: number;
    temperature: number;
    system: string;
    messages: AnthropicMessage[];
    tools: ToolDefinition[];
    signal?: AbortSignal;
  },
  callbacks?: StreamCallbacks,
): Promise<Result<TurnResult, Error>> {
  const client = getClient();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) return err(new Error("CANCELLED"));

    try {
      const result = await runStream(
        client,
        { model, maxTokens, temperature, system, messages, tools, signal },
        callbacks,
      );
      return ok(result);
    } catch (e) {
      const status = (e as { status?: number }).status;
      const isRetryable = status !== undefined && RETRYABLE.has(status);
      const isLast = attempt === MAX_ATTEMPTS - 1;

      if (!isRetryable || isLast) {
        log.error("Anthropic API error", { attempt, status, error: String(e) });
        return err(e instanceof Error ? e : new Error(String(e)));
      }

      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
      log.warn("Anthropic transient error, retrying", { attempt, status, delayMs: delay });
      await sleep(delay, signal);
    }
  }

  return err(new Error("ANTHROPIC_RETRY_EXHAUSTED"));
}

async function runStream(
  client: Anthropic,
  {
    model,
    maxTokens,
    temperature,
    system,
    messages,
    tools,
    signal,
  }: {
    model: string;
    maxTokens: number;
    temperature: number;
    system: string;
    messages: AnthropicMessage[];
    tools: ToolDefinition[];
    signal?: AbortSignal;
  },
  callbacks?: StreamCallbacks,
): Promise<TurnResult> {
  const textBlocks: string[] = [];
  const toolCalls: TurnResult["toolCalls"] = [];
  let currentText = "";
  let currentToolId = "";
  let currentToolName = "";
  let currentToolJson = "";
  let stopReason: TurnResult["stopReason"] = "end_turn";
  let inputTokens = 0;
  let outputTokens = 0;

  // Cast messages to match SDK type (our types are a subset of theirs)
  // deno-lint-ignore no-explicit-any
  const sdkMessages = messages as any[];

  const stream = await client.messages.stream({
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: sdkMessages,
    tools: tools as Anthropic.Tool[],
  });

  for await (const event of stream) {
    if (signal?.aborted) {
      stream.controller.abort();
      throw new Error("CANCELLED");
    }

    switch (event.type) {
      case "message_start":
        inputTokens = event.message.usage.input_tokens;
        break;

      case "content_block_start":
        if (event.content_block.type === "text") {
          currentText = "";
        } else if (event.content_block.type === "tool_use") {
          currentToolId = event.content_block.id;
          currentToolName = event.content_block.name;
          currentToolJson = "";
        }
        break;

      case "content_block_delta":
        if (event.delta.type === "text_delta") {
          currentText += event.delta.text;
          callbacks?.onTextDelta?.(event.delta.text);
        } else if (event.delta.type === "input_json_delta") {
          currentToolJson += event.delta.partial_json;
          callbacks?.onInputJsonDelta?.(currentToolId, event.delta.partial_json);
        }
        break;

      case "content_block_stop":
        if (currentText) {
          textBlocks.push(currentText);
          currentText = "";
        }
        if (currentToolId) {
          let toolInput: unknown = {};
          try { toolInput = JSON.parse(currentToolJson); } catch { /* malformed → empty */ }
          toolCalls.push({ id: currentToolId, name: currentToolName, input: toolInput });
          currentToolId = "";
          currentToolName = "";
          currentToolJson = "";
        }
        break;

      case "message_delta":
        stopReason = event.delta.stop_reason as TurnResult["stopReason"] ?? "end_turn";
        outputTokens = event.usage.output_tokens;
        break;
    }
  }

  log.debug("Anthropic turn complete", { stopReason, inputTokens, outputTokens, toolCalls: toolCalls.length });
  return { stopReason, textBlocks, toolCalls, inputTokens, outputTokens };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(new Error("CANCELLED")); });
  });
}
