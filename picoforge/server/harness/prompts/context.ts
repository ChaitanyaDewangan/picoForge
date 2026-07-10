// server/harness/prompts/context.ts — LLM_HARNESS §9 context window
// History windowing: last 20 message blocks; brief + stats always kept;
// old code bodies elided to "[code vN — M lines, compiled ✓]"

import type { AnthropicMessage } from "../anthropic.ts";

const MAX_HISTORY_BLOCKS = 20;

// Brief/stats block shape (from DB in M3; stub for M2)
export interface HistoryEntry {
  role: "user" | "assistant";
  blocks: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: unknown }
    | { type: "tool_result"; tool_use_id: string; content: Array<{ type: "text"; text: string }> }
  >;
  // For code elision tracking:
  codeVersion?: number;
  codeLines?: number;
  codeOk?: boolean;
  captureIncluded?: boolean;  // images only kept for the turn they were requested
}

/**
 * Build the messages array for the next API call.
 *
 * Rules (§9):
 * - Always include: latest accepted brief, latest success stats, current code header
 * - Last 20 message blocks
 * - Old run_picogk code bodies → elided header "[code v{n}, {lines} lines, {ok|failed:CODE}]"
 * - Capture images only in the turn they were requested
 */
export function buildContextMessages(
  history: HistoryEntry[],
  opts: {
    latestBriefJson?: unknown;
    latestStats?: unknown;
    latestCodeVersion?: number;
  } = {},
): AnthropicMessage[] {
  const messages: AnthropicMessage[] = [];

  // Pin: latest accepted brief as a system reminder
  if (opts.latestBriefJson) {
    messages.push({
      role: "user",
      content: [{
        type: "text",
        text: `[PINNED] Latest accepted brief:\n${JSON.stringify(opts.latestBriefJson, null, 2)}`,
      }],
    });
    messages.push({
      role: "assistant",
      content: [{ type: "text", text: "Brief acknowledged." }],
    });
  }

  // Last N history entries, eliding old code bodies
  const recent = history.slice(-MAX_HISTORY_BLOCKS);
  for (const entry of recent) {
    const content: AnthropicMessage["content"] = [];

    for (const block of entry.blocks) {
      if (block.type === "tool_use" && block.name === "run_picogk") {
        // Elide old code bodies
        const isLatest = entry.codeVersion === opts.latestCodeVersion;
        if (!isLatest && entry.codeVersion !== undefined) {
          const status = entry.codeOk ? "compiled ✓" : "failed";
          content.push({
            type: "tool_use",
            id: block.id,
            name: "run_picogk",
            input: {
              code: `[code v${entry.codeVersion} — ${entry.codeLines ?? "?"} lines, ${status}]`,
              notes: (block.input as { notes?: string }).notes ?? "",
            },
          });
          continue;
        }
      }

      if (block.type === "tool_result") {
        // Drop image blocks from past captures (keep only text)
        const filteredContent = block.content
          .filter(c => c.type === "text" || entry.captureIncluded)
          .map(c => c as { type: "text"; text: string });
        content.push({ ...block, content: filteredContent });
        continue;
      }

      content.push(block as AnthropicMessage["content"][number]);
    }

    if (content.length > 0) {
      messages.push({ role: entry.role, content });
    }
  }

  return messages;
}
