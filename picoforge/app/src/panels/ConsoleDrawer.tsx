// app/src/panels/ConsoleDrawer.tsx — UIUX §3.8
// Tabs: BUILD / ENGINE / EVENTS, mono 12, autoscroll-with-pin, filter input.
// Row hover reveals "copy line".

import { useState, useEffect, useRef, useCallback } from "react";
import "./ConsoleDrawer.css";

export type ConsoleArea = "build" | "engine" | "events";

export interface ConsoleLog {
  area: ConsoleArea;
  line: string;
  ts: number;
}

const TABS: ConsoleArea[] = ["build", "engine", "events"];

interface Props {
  open: boolean;
  onToggle: () => void;
  logs: ConsoleLog[];
}

export function ConsoleDrawer({ open, onToggle, logs }: Props) {
  const [activeTab, setActiveTab] = useState<ConsoleArea>("build");
  const [filter, setFilter] = useState("");
  const [pinned, setPinned] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Filter logs by tab + text filter
  const visible = logs.filter(
    (l) => l.area === activeTab && (filter ? l.line.toLowerCase().includes(filter.toLowerCase()) : true),
  );

  // Autoscroll when pinned
  useEffect(() => {
    if (!pinned || !open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [visible.length, pinned, open]);

  // Unpin when user scrolls up
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    setPinned(atBottom);
  }, []);

  const copyLine = useCallback(async (line: string, idx: number) => {
    await navigator.clipboard.writeText(line);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1200);
  }, []);

  return (
    <div
      id="console-drawer"
      className={`console-drawer${open ? " console-drawer--open" : ""}`}
      style={{
        height: open ? "var(--console-h-open)" : "var(--console-h-collapsed)",
      }}
    >
      {/* Collapsed handle — always visible, click to toggle */}
      <div
        id="console-handle"
        className="console-handle"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls="console-drawer"
        onClick={onToggle}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
      >
        <span className="micro-label">CONSOLE</span>
        <div className="console-tabs-row">
          {TABS.map((tab) => (
            <button
              key={tab}
              id={`console-tab-${tab}`}
              className={`console-tab ${activeTab === tab && open ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab(tab);
                if (!open) onToggle();
              }}
              aria-selected={activeTab === tab}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          {pinned && open && (
            <span className="micro-label" style={{ color: "var(--amber)" }}>⬇ AUTO</span>
          )}
          <span className="micro-label" style={{ color: "var(--ink-2)" }}>{open ? "▾" : "▴"}</span>
        </div>
      </div>

      {/* Content — only rendered when open */}
      {open && (
        <div className="console-content">
          <div className="console-filter-row">
            <input
              id="console-filter"
              className="console-filter-input"
              type="text"
              placeholder="filter…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter console output"
            />
            <span className="micro-label">{visible.length} lines</span>
          </div>

          <div
            ref={listRef}
            className="console-log-list"
            onScroll={handleScroll}
            aria-label={`${activeTab} console log`}
            aria-live="polite"
            aria-atomic="false"
          >
            {visible.length === 0 ? (
              <div className="console-empty micro-label">No {activeTab} output yet.</div>
            ) : (
              visible.map((log, i) => (
                <div key={i} className="console-log-row">
                  <span className="console-ts readout">
                    {new Date(log.ts).toISOString().slice(11, 23)}
                  </span>
                  <span className="console-line">{log.line}</span>
                  <button
                    className="console-copy-btn btn-tertiary"
                    aria-label="Copy line"
                    tabIndex={-1}
                    onClick={() => copyLine(log.line, i)}
                  >
                    {copiedIdx === i ? "✓" : "⎘"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
