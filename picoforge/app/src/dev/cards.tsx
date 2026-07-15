// app/src/dev/cards.tsx — M4 fixture page: /dev/cards
// Shows every card component in every state per UIUX §3.
// Linked from vite.config.ts extra entry in dev mode.

import { BriefCard } from "../chat/BriefCard.tsx";
import { BuildCard } from "../chat/BuildCard.tsx";
import { ErrorCard } from "../chat/ErrorCard.tsx";
import type { RunInfo } from "../state/chatStore.ts";

// ─── Fixture data ─────────────────────────────────────────────────────────────

const BRIEF_FULL = {
  category: "Fluid Dynamics",
  material: "PETG",
  accepted: false,
  parameters: [
    { name: "Blade count", value: "7", rationale: "Optimal for 120mm fan aerodynamics" },
    { name: "Diameter", value: "120.0", unit: "mm" },
    { name: "Hub diameter", value: "38.0", unit: "mm" },
    { name: "Blade height", value: "24.0", unit: "mm" },
    { name: "Tip clearance", value: "0.8", unit: "mm" },
    { name: "Blade angle (tip)", value: "32°" },
  ],
  physicsChecks: [
    { label: "TIP SPEED", value: "11.3 m/s", limit: "30 m/s", ok: true },
    { label: "SOLIDITY", value: "0.68", limit: "0.85", ok: true },
    { label: "RE TIP", value: "1.2 × 10⁴", limit: "5 × 10⁵", ok: true },
  ],
};

const BRIEF_COLLAPSED = { ...BRIEF_FULL, accepted: true };

function makeRun(state: RunInfo["state"], stage?: string, attempt = 1): RunInfo {
  const steps: RunInfo["steps"] = state !== "queued"
    ? [
        {
          stepId: "s1",
          tool: "submit_design_brief",
          title: "Submit design brief",
          logs: [],
          ok: true,
          summaryJson: null,
        },
      ]
    : [];

  if (["compiling", "executing", "validating", "done", "failed"].includes(state)) {
    steps.push({
      stepId: "s2",
      tool: "run_picogk",
      title: stage ?? state,
      logs: [
        "Compiling Design.cs with PicoGK 2.1.1",
        "Voxelizing 7 blades…",
        "Hub subtraction done · 1,842 ms",
      ],
      ok: state === "done" ? true : state === "failed" ? false : null,
      summaryJson:
        state === "done"
          ? { volumeCm3: 42.71, watertight: true, durationMs: 4218 }
          : null,
    });
  }

  return { runId: `run-fixture-${state}`, state, attempt, stage, steps };
}

const RUNS: Record<string, RunInfo> = {
  "run-fixture-queued": makeRun("queued"),
  "run-fixture-briefing": makeRun("briefing", "Extracting parameters…"),
  "run-fixture-compiling": makeRun("compiling", "Compiling Design.cs…"),
  "run-fixture-executing": makeRun("executing", "Voxelizing blades…"),
  "run-fixture-done": makeRun("done", undefined, 1),
  "run-fixture-failed": makeRun("failed", "COMPILE_ERROR: ambiguous reference", 2),
  "run-fixture-cancelled": makeRun("cancelled"),
};

// ─── Fixture page ─────────────────────────────────────────────────────────────

export function CardsFixturePage() {
  function noop() {}

  return (
    <div
      style={{
        background: "var(--bg-0)",
        minHeight: "100vh",
        padding: "32px var(--pad-lg)",
        display: "flex",
        flexDirection: "column",
        gap: 40,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 20,
          fontWeight: 600,
          color: "var(--ink)",
          letterSpacing: "0.04em",
        }}
      >
        ◆ PICOFORGE — Card Fixture Page
      </div>
      <p className="micro-label">Every card in every state. Used for M4 visual gate.</p>

      {/* ── Brief Card ───────────────────────────────────────────────────── */}
      <Section title="BRIEF CARD">
        <Row label="Expanded (not accepted)">
          <BriefCard brief={BRIEF_FULL} />
        </Row>
        <Row label="Collapsed (accepted)">
          <BriefCard brief={BRIEF_COLLAPSED} />
        </Row>
      </Section>

      {/* ── Build Card ───────────────────────────────────────────────────── */}
      <Section title="BUILD CARD — all states">
        {Object.entries(RUNS).map(([runId, run]) => (
          <Row key={runId} label={`state: ${run.state}${run.stage ? ` · ${run.stage}` : ""}`}>
            <BuildCard
              run={run}
              runId={runId}
              onCancel={noop}
              onViewCode={noop}
            />
          </Row>
        ))}
      </Section>

      {/* ── Error Card ───────────────────────────────────────────────────── */}
      <Section title="ERROR CARD">
        <Row label="With detail + action">
          <ErrorCard
            code="COMPILE_ERROR"
            message="C# compilation failed — 2 errors in Design.cs"
            detail={`CS0246: The type or namespace 'PicoGK' could not be found\nCS1002: ; expected (line 42)`}
            action={{ label: "Retry with 0.5 mm voxels", onClick: noop }}
          />
        </Row>
        <Row label="Plain (no detail)">
          <ErrorCard
            code="ENGINE_LOST"
            message="Engine process exited unexpectedly — run marked failed"
          />
        </Row>
        <Row label="API error">
          <ErrorCard
            code="API_ERROR"
            message="Anthropic API returned 529 (overloaded) — retrying in 4 s"
            detail="Attempt 2 of 6"
          />
        </Row>
      </Section>

      {/* ── Streaming text ───────────────────────────────────────────────── */}
      <Section title="STREAMING TEXT">
        <Row label="Mid-stream cursor">
          <div className="message-text streaming" style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body)" }}>
            I&apos;ll design a 7-blade fan impeller optimised for low noise at 2400 RPM…
            <span className="streaming-cursor">▋</span>
          </div>
        </Row>
      </Section>
    </div>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        className="micro-label"
        style={{
          borderBottom: "1px solid var(--line)",
          paddingBottom: 6,
          color: "var(--amber)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 540 }}>
      <div className="micro-label" style={{ color: "var(--ink-2)" }}>{label}</div>
      {children}
    </div>
  );
}
