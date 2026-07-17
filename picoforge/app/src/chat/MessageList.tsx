// app/src/chat/MessageList.tsx — conversation scroll area
// Renders ChatMessage[] using role-based layout + block dispatch to cards.
// UIUX §3.1–3.7

import { useEffect, useRef } from "react";
import type { ChatMessage, MsgBlock, RunInfo } from "../state/chatStore.ts";
import { BuildCard } from "./BuildCard.tsx";
import { BriefCard, type BriefData } from "./BriefCard.tsx";
import { ErrorCard } from "./ErrorCard.tsx";
import "./MessageList.css";

interface Props {
  messages: ChatMessage[];
  runs: Map<string, RunInfo>;
  onCancel: (runId: string) => void;
  onViewCode?: (runId: string) => void;
}

export function MessageList({ messages, runs, onCancel, onViewCode }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll: only scroll if user is near bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 120;
    if (nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  if (messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div
      id="message-list"
      ref={scrollRef}
      className="message-list"
      aria-label="Conversation"
      role="log"
      aria-live="polite"
    >
      {messages.map((msg) => (
        <MessageRow
          key={msg.id}
          msg={msg}
          runs={runs}
          onCancel={onCancel}
          onViewCode={onViewCode}
        />
      ))}
      <div ref={bottomRef} style={{ height: 1 }} />
    </div>
  );
}

// ─── Message row ──────────────────────────────────────────────────────────────

function MessageRow({
  msg,
  runs,
  onCancel,
  onViewCode,
}: {
  msg: ChatMessage;
  runs: Map<string, RunInfo>;
  onCancel: (runId: string) => void;
  onViewCode?: (runId: string) => void;
}) {
  const isUser = msg.role === "user";

  return (
    <div
      className={`message-row ${isUser ? "message-row--user" : "message-row--assistant"}`}
      data-message-id={msg.id}
    >
      {!isUser && (
        <div className="message-avatar micro-label">◆</div>
      )}

      <div className="message-content">
        {/* Streaming text (before CHAT_DONE) */}
        {msg.streamingText !== undefined && msg.streamingText && (
          <div className="message-text streaming">
            {msg.streamingText}
            <span className="streaming-cursor">▋</span>
          </div>
        )}
        {/* Empty streaming state */}
        {msg.streamingText !== undefined && !msg.streamingText && msg.blocks.length === 0 && (
          <div className="message-text streaming">
            <span className="streaming-cursor">▋</span>
          </div>
        )}

        {/* Finalized blocks */}
        {msg.blocks.map((block, i) => (
          <BlockRenderer
            key={i}
            block={block}
            runs={runs}
            onCancel={onCancel}
            onViewCode={onViewCode}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Block renderer ───────────────────────────────────────────────────────────

function BlockRenderer({
  block,
  runs,
  onCancel,
  onViewCode,
}: {
  block: MsgBlock;
  runs: Map<string, RunInfo>;
  onCancel: (runId: string) => void;
  onViewCode?: (runId: string) => void;
}) {
  switch (block.t) {
    case "text":
      return <TextBlock text={block.text} />;

    case "build": {
      const run = runs.get(block.runId);
      if (!run) {
        return (
          <div className="micro-label" style={{ color: "var(--ink-2)" }}>
            Loading run {block.runId.slice(-8)}…
          </div>
        );
      }
      return (
        <BuildCard
          run={run}
          runId={block.runId}
          onCancel={onCancel}
          onViewCode={onViewCode}
        />
      );
    }

    case "brief": {
      const data = block.brief as BriefData;
      return <BriefCard brief={data} />;
    }

    case "error":
      return (
        <ErrorCard
          code={block.code}
          message={block.msg}
        />
      );

    case "geometry":
      return (
        <div className="micro-label" style={{ color: "var(--ok)" }}>
          ✓ Geometry loaded · {block.artifactId.slice(-8).toUpperCase()}
        </div>
      );

    default:
      return null;
  }
}

// ─── Plain text block with ask_user options ───────────────────────────────────

function TextBlock({ text }: { text: string }) {
  // Detect ask_user option syntax: lines starting with "- " after a "?" line
  // Simple heuristic: if text has OPTIONS: section
  const optionsMatch = text.match(/^([\s\S]*?)\n?OPTIONS:\s*\n([\s\S]+)$/m);

  if (optionsMatch) {
    const mainText = optionsMatch[1].trim();
    const optLines = optionsMatch[2]
      .split("\n")
      .map((l) => l.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);

    return (
      <div>
        <div className="message-text">{renderText(mainText)}</div>
        <div className="ask-user-options">
          {optLines.map((opt, i) => (
            <button
              key={i}
              className="ask-user-option"
              id={`ask-opt-${i}`}
              onClick={() => {/* handled by parent via onSend */}}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return <div className="message-text">{renderText(text)}</div>;
}

/** Very light formatting: code spans (backtick) and newlines */
function renderText(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12.5px",
            background: "var(--bg-0)",
            padding: "1px 4px",
            borderRadius: "var(--r)",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      id="chat-empty-state"
      className="empty-state-grain"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        position: "relative",
        padding: "40px 24px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "20px",
          fontWeight: 600,
          color: "var(--ink-2)",
          letterSpacing: "0.04em",
          textAlign: "center",
        }}
      >
        DESCRIBE A PART.
      </div>
      <div className="micro-label" style={{ textAlign: "center", maxWidth: "280px" }}>
        The harness will brief, code, compile, and build it — all in the viewport.
      </div>

      {/* Starter chips */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", maxWidth: "340px" }}>
        {STARTER_PROMPTS.map((p, i) => (
          <div
            key={i}
            className="starter-chip"
          >
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}

const STARTER_PROMPTS = [
  "Build a 7-blade 120 mm fan impeller for PETG printing",
  "Design a bracket with 4 M6 mounting holes, 2 mm wall thickness",
  "Create a parametric gear with 24 teeth, module 1.5, 20° pressure angle",
];
