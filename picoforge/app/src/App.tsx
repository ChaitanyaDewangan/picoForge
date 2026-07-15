// App.tsx — PicoForge shell — M4 complete
// UIUX §1: Topbar (h44) + resizable split (Chat 40% | Viewport 60%) + Console drawer
// Wires: WS client, chat store, all components, keyboard shortcuts, settings, wizard.

import { useState, useEffect, useCallback, useRef } from "react";
import { MessageList } from "./chat/MessageList.tsx";
import { Composer } from "./chat/Composer.tsx";
import { ConsoleDrawer } from "./panels/ConsoleDrawer.tsx";
import { SettingsDialog } from "./panels/SettingsDialog.tsx";
import { FirstRunWizard } from "./panels/FirstRunWizard.tsx";
import { useChatStore } from "./state/chatStore.ts";
import { ViewportPane } from "./viewport/ViewportPane.tsx";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEMO_CONV_ID = "demo-conv-01"; // replaced by real project in M6

// ─── Topbar ───────────────────────────────────────────────────────────────────

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
      style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "default" }}
    >
      <span
        style={{
          color: colors[status],
          fontSize: "10px",
          animation: status === "degraded" ? "pulse-amber 1.2s steps(2) infinite" : undefined,
        }}
      >
        {symbols[status]}
      </span>
      {label}
    </span>
  );
}

interface TopbarProps {
  connected: boolean;
  projectName?: string;
  onSettings: () => void;
  onConsole: () => void;
}

function Topbar({ connected, projectName, onSettings, onConsole }: TopbarProps) {
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
        gap: 16,
      }}
    >
      {/* Left: wordmark + project */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "15px",
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: "var(--ink)",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          ◆ PICOFORGE
        </div>
        {projectName && (
          <>
            <span className="micro-label" style={{ color: "var(--line)" }}>│</span>
            <span className="micro-label" style={{ color: "var(--ink-2)" }}>
              PROJECT: {projectName.toUpperCase()}
            </span>
          </>
        )}
      </div>

      {/* Right: status dots + settings */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <StatusDot
          id="engine-dot"
          label="ENGINE"
          status={connected ? "ok" : "down"}
        />
        <StatusDot id="rt-dot" label="RT" status="down" />
        <button
          id="console-btn"
          className="btn-tertiary"
          aria-label="Console (Ctrl+J)"
          title="Console (Ctrl+J)"
          onClick={onConsole}
        >
          ▤
        </button>
        <button
          id="settings-btn"
          className="btn-tertiary"
          aria-label="Settings (Ctrl+,)"
          title="Settings (Ctrl+,)"
          onClick={onSettings}
        >
          ⚙
        </button>
      </div>
    </header>
  );
}


// ─── Split divider with drag ──────────────────────────────────────────────────


function SplitDivider({
  chatWidthPx,
  containerWidth,
  onChange,
  onReset,
}: {
  chatWidthPx: number;
  containerWidth: number;
  onChange: (px: number) => void;
  onReset: () => void;
}) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      startX.current = e.clientX;
      startW.current = chatWidthPx;
      e.preventDefault();
    },
    [chatWidthPx],
  );

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const newW = Math.max(420, Math.min(containerWidth * 0.55, startW.current + delta));
      onChange(newW);
    }
    function onUp() { dragging.current = false; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [containerWidth, onChange]);

  return (
    <div
      id="split-divider"
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize · Double-click to reset"
      onMouseDown={onMouseDown}
      onDoubleClick={onReset}
      style={{
        width: "6px",
        cursor: "col-resize",
        background: "transparent",
        borderLeft: "1px solid var(--line)",
        flexShrink: 0,
        position: "relative",
        zIndex: 1,
        transition: "border-color var(--t-micro)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderLeftColor = "var(--ink-2)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderLeftColor = "var(--line)")}
    />
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);
  const [chatWidthPx, setChatWidthPx] = useState(Math.max(420, window.innerWidth * 0.4));
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const { state, sendMessage, cancelRun } = useChatStore(DEMO_CONV_ID);

  // Check first run on mount
  useEffect(() => {
    const done = localStorage.getItem("picoforge.setup.done");
    if (!done) setShowWizard(true);
  }, []);

  // Track container width for clamp during drag
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      setContainerWidth(containerRef.current?.clientWidth ?? window.innerWidth);
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === ",") { e.preventDefault(); setSettingsOpen((o) => !o); }
        if (e.key === "j") { e.preventDefault(); setConsoleOpen((o) => !o); }
      }
      if (e.key === "Escape" && settingsOpen) setSettingsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  const resetSplit = useCallback(() => {
    setChatWidthPx(Math.max(420, containerWidth * 0.4));
  }, [containerWidth]);

  // Count active runs (non-terminal)
  const activeRuns = [...state.runs.values()].filter(
    (r) => !["done", "failed", "cancelled"].includes(r.state),
  );

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
      <Topbar
        connected={state.connected}
        projectName="FAN-IMPELLER"
        onSettings={() => setSettingsOpen(true)}
        onConsole={() => setConsoleOpen((o) => !o)}
      />

      {/* Main split */}
      <div
        id="main-split"
        ref={containerRef}
        style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}
      >
        {/* Chat pane */}
        <div
          id="chat-pane"
          style={{
            width: chatWidthPx,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-1)",
            borderRight: "none",
            minWidth: "var(--chat-pane-min)",
            overflow: "hidden",
          }}
        >
          <MessageList
            messages={state.messages}
            runs={state.runs}
            onCancel={cancelRun}
            onSend={sendMessage}
          />
          <Composer
            onSend={sendMessage}
            pendingQueue={activeRuns.length}
          />
        </div>

        <SplitDivider
          chatWidthPx={chatWidthPx}
          containerWidth={containerWidth}
          onChange={setChatWidthPx}
          onReset={resetSplit}
        />

        <ViewportPane
          artifact={state.lastArtifact ?? null}
        />
      </div>

      {/* Console drawer */}
      <ConsoleDrawer
        open={consoleOpen}
        onToggle={() => setConsoleOpen((o) => !o)}
        logs={state.consoleLogs}
      />

      {/* Dialogs */}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <FirstRunWizard
        open={showWizard}
        onComplete={() => {
          localStorage.setItem("picoforge.setup.done", "1");
          setShowWizard(false);
        }}
      />
    </div>
  );
}
