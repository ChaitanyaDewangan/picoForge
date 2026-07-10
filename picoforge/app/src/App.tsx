// App.tsx — PicoForge shell layout
// UIUX §1: Topbar (h44) + split pane (Chat 40% | Viewport 60%) + Console drawer (collapsed 28px)
// M0: structural scaffold only — components filled in M4

import { useState } from "react";

// ─── Topbar ───────────────────────────────────────────────────────────────────
function Topbar() {
  return (
    <header
      id="topbar"
      style={{
        height: "var(--topbar-h)",
        background: "var(--bg-1)",
        borderBottom: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--pad-lg)",
        flexShrink: 0,
      }}
    >
      {/* Wordmark — UIUX §3.9 */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "15px",
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "var(--ink)",
          userSelect: "none",
        }}
      >
        ◆ PICOFORGE
      </div>

      {/* Right cluster: engine status · RT · settings */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* ENGINE dot */}
        <StatusDot id="engine-dot" label="ENGINE" status="down" />
        {/* RT dot */}
        <StatusDot id="rt-dot" label="RT" status="down" />
        {/* Settings gear */}
        <button
          id="settings-btn"
          className="btn-tertiary"
          aria-label="Settings"
          title="Settings (Ctrl+,)"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}

type DotStatus = "ok" | "degraded" | "down";

function StatusDot({ id, label, status }: { id: string; label: string; status: DotStatus }) {
  const colors: Record<DotStatus, string> = {
    ok: "var(--ok)",
    degraded: "var(--amber)",
    down: "var(--ink-2)",
  };
  const symbols: Record<DotStatus, string> = { ok: "●", degraded: "◐", down: "○" };
  return (
    <span
      id={id}
      className="micro-label"
      title={`${label}: ${status}`}
      style={{ display: "flex", alignItems: "center", gap: "4px" }}
    >
      <span style={{ color: colors[status], fontSize: "10px" }}>{symbols[status]}</span>
      {label}
    </span>
  );
}

// ─── Chat pane placeholder ────────────────────────────────────────────────────
function ChatPane() {
  return (
    <div
      id="chat-pane"
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-1)",
        borderRight: "1px solid var(--line)",
        minWidth: "var(--chat-pane-min)",
        overflow: "hidden",
      }}
    >
      {/* Conversation scroll area — filled in M4 */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "var(--pad-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* M0: empty state placeholder */}
        <div
          className="empty-state-grain"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            position: "relative",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-section)",
              fontWeight: 600,
              color: "var(--ink-2)",
              textAlign: "center",
            }}
          >
            SCAFFOLD M0
          </div>
          <div className="micro-label">Chat components arrive in M4</div>
        </div>
      </div>

      {/* Composer — filled in M4 */}
      <div
        id="composer"
        style={{
          borderTop: "1px solid var(--line)",
          padding: "var(--pad)",
          display: "flex",
          gap: "8px",
        }}
      >
        <input
          id="composer-input"
          type="text"
          placeholder="Describe a part to build…"
          aria-label="Message composer"
          style={{
            flex: 1,
            background: "var(--bg-2)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r)",
            color: "var(--ink)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body)",
            padding: "8px 12px",
            outline: "none",
            transition: "border-color var(--t-micro)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--amber)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line)")}
        />
        <button className="btn-primary" id="send-btn">⏎</button>
      </div>
    </div>
  );
}

// ─── Viewport pane placeholder ────────────────────────────────────────────────
function ViewportPane() {
  return (
    <div
      id="viewport-pane"
      className="viewport-backdrop"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Canvas — three.js mounts here in M5 */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "20px",
              fontWeight: 600,
              color: "var(--ink-2)",
              letterSpacing: "0.04em",
            }}
          >
            NOTHING ON THE PLATE.
          </div>
          <div className="micro-label">DESCRIBE A PART IN THE CHAT — IT BUILDS HERE.</div>
          <div className="micro-label" style={{ marginTop: "4px" }}>
            three.js viewport arrives in M5
          </div>
        </div>
      </div>

      {/* DRO strip — filled in M5 */}
      <div
        id="dro-strip"
        style={{
          borderTop: "1px solid var(--line)",
          background: "var(--bg-1)",
          padding: "6px var(--pad)",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        <div className="readout" style={{ color: "var(--ink-2)" }}>
          VOL — cm³ · ⌀ — · H — · WT —
        </div>
        <div className="micro-label">ORTHO · ISO · IDLE · RT OFF</div>
      </div>
    </div>
  );
}

// ─── Console drawer ───────────────────────────────────────────────────────────
function ConsoleDrawer({ open }: { open: boolean }) {
  return (
    <div
      id="console-drawer"
      style={{
        height: open ? "var(--console-h-open)" : "var(--console-h-collapsed)",
        background: "var(--bg-2)",
        borderTop: "1px solid var(--line)",
        transition: "height var(--t-state)",
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: "var(--console-h-collapsed)",
          display: "flex",
          alignItems: "center",
          padding: "0 var(--pad)",
          gap: "16px",
          flexShrink: 0,
          cursor: "pointer",
        }}
      >
        <span className="micro-label">CONSOLE</span>
        <span className="micro-label" style={{ color: "var(--ink)" }}>BUILD</span>
        <span className="micro-label">ENGINE</span>
        <span className="micro-label">EVENTS</span>
      </div>
      {open && (
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "0 var(--pad) var(--pad)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--ink-2)",
          }}
        >
          <div>Console drawer — mono build &amp; engine logs (M4)</div>
        </div>
      )}
    </div>
  );
}

// ─── Split divider ────────────────────────────────────────────────────────────
function SplitDivider({ onDoubleClick }: { onDoubleClick: () => void }) {
  return (
    <div
      id="split-divider"
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize · Double-click to reset"
      onDoubleClick={onDoubleClick}
      style={{
        width: "6px",        /* hit area */
        cursor: "col-resize",
        background: "transparent",
        borderLeft: "1px solid var(--line)",
        flexShrink: 0,
        position: "relative",
        zIndex: 1,
      }}
    />
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export function App() {
  const [chatWidth, setChatWidth] = useState<string>("var(--chat-pane-default)");
  const [consoleOpen, setConsoleOpen] = useState(false);

  function resetSplit() {
    setChatWidth("var(--chat-pane-default)");
  }

  return (
    <div
      id="app-root"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: "var(--bg-0)",
      }}
    >
      <Topbar />

      {/* Main split area */}
      <div
        id="main-split"
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        <div style={{ width: chatWidth, flexShrink: 0, display: "flex" }}>
          <ChatPane />
        </div>
        <SplitDivider onDoubleClick={resetSplit} />
        <ViewportPane />
      </div>

      {/* Console drawer */}
      <div
        id="console-toggle"
        onClick={() => setConsoleOpen((o) => !o)}
        style={{ cursor: "pointer" }}
      >
        <ConsoleDrawer open={consoleOpen} />
      </div>
    </div>
  );
}
