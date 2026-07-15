// app/src/chat/BuildCard.tsx — UIUX §3.2
// Machine job-traveler that lives in the transcript and IS the run UI.
// Never disappears — permanent record of the run.

import { useState, useCallback } from "react";
import "./cards.css";
import type { RunInfo } from "../state/chatStore.ts";

// Stages in display order
const STAGES = ["brief", "code", "compile", "run", "validate"] as const;
type Stage = (typeof STAGES)[number];

function stageFromRunState(state: RunInfo["state"], stage?: string): Stage {
  const stageStr = stage?.toLowerCase() ?? "";
  if (stageStr.includes("brief")) return "brief";
  if (stageStr.includes("code") || state === "codegen") return "code";
  if (stageStr.includes("compil") || state === "compiling") return "compile";
  if (stageStr.includes("run") || state === "executing") return "run";
  if (stageStr.includes("valid") || state === "validating") return "validate";
  if (state === "done" || state === "failed" || state === "cancelled") return "validate";
  return "brief";
}

function isTerminal(state: RunInfo["state"]): boolean {
  return state === "done" || state === "failed" || state === "cancelled";
}

function getProgressPercent(state: RunInfo["state"], stage?: string): number {
  if (state === "done") return 100;
  if (state === "failed" || state === "cancelled") return 100;
  const stageStr = stage?.toLowerCase() ?? "";
  if (stageStr.includes("brief")) return 8;
  if (stageStr.includes("code")) return 28;
  if (stageStr.includes("compil")) return 52;
  if (stageStr.includes("run") || stageStr.includes("voxel")) return 72;
  if (stageStr.includes("valid")) return 90;
  return 15;
}

interface Props {
  run: RunInfo;
  runId: string;
  onCancel: (runId: string) => void;
  onViewCode?: (runId: string) => void;
}

export function BuildCard({ run, runId, onCancel, onViewCode }: Props) {
  const [logsOpen, setLogsOpen] = useState(false);
  const activeStage = stageFromRunState(run.state, run.stage);
  const done = run.state === "done";
  const failed = run.state === "failed";
  const cancelled = run.state === "cancelled";
  const terminal = isTerminal(run.state);
  const progress = getProgressPercent(run.state, run.stage);
  const isIndeterminate = !terminal && progress === 15;

  // Latest log line for status text
  const lastStep = run.steps[run.steps.length - 1];
  const statusText = run.stage ?? lastStep?.title ?? run.state;

  // Short run ID display
  const shortId = runId.slice(-8).toUpperCase();

  const handleCancel = useCallback(() => onCancel(runId), [onCancel, runId]);

  const cardClass = [
    "build-card",
    done ? "done" : failed ? "failed" : !terminal ? "active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClass} aria-label={`Build run ${shortId}`}>
      {/* Header row */}
      <div className="build-card-header">
        <span className="build-card-id">BUILD {shortId} — attempt {run.attempt}</span>

        {/* Stage rail */}
        <div className="stage-rail" aria-label="Build stages">
          {STAGES.map((s, i) => (
            <span key={s} style={{ display: "contents" }}>
              <span
                className={[
                  "stage-dot",
                  failed && i === STAGES.indexOf(activeStage) ? "error"
                    : i < STAGES.indexOf(activeStage) || terminal ? "done"
                    : i === STAGES.indexOf(activeStage) && !terminal ? "active"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={s.toUpperCase()}
              />
              {i < STAGES.length - 1 && (
                <span className="stage-arrow">▶</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Body: progress + status + actions */}
      {!terminal && (
        <div className="build-card-body">
          <div className="progress-bar-track" role="progressbar" aria-valuenow={progress}>
            <div
              className={`progress-bar-fill${isIndeterminate ? " indeterminate" : ""}`}
              style={{ width: isIndeterminate ? undefined : `${progress}%` }}
            />
          </div>

          <div className="build-card-stage-row">
            <span className="build-card-status-text">{statusText}</span>
          </div>

          <div className="build-card-actions">
            {onViewCode && (
              <button
                className="btn-tertiary"
                id={`view-code-${shortId}`}
                onClick={() => onViewCode(runId)}
              >
                ▸ view code
              </button>
            )}
            {lastStep && (
              <button
                className="btn-tertiary"
                id={`view-log-${shortId}`}
                onClick={() => setLogsOpen((o) => !o)}
              >
                ▸ log {logsOpen ? "▴" : "▾"}
              </button>
            )}
            <button
              className="btn-tertiary"
              id={`cancel-${shortId}`}
              style={{ color: "var(--err)", marginLeft: "auto" }}
              onClick={handleCancel}
            >
              ✕ cancel
            </button>
          </div>

          {logsOpen && lastStep && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--ink-2)",
                maxHeight: "120px",
                overflow: "auto",
                padding: "6px 0",
              }}
            >
              {lastStep.logs.slice(-20).map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Done state footer */}
      {done && (
        <BuildCardDoneRow run={run} runId={runId} onViewCode={onViewCode} />
      )}

      {/* Failed state footer */}
      {(failed || cancelled) && (
        <div className="build-card-fail-row">
          <span className="build-card-fail-text">
            {cancelled ? "✕ CANCELLED" : "✗ FAILED"} — attempt {run.attempt}
            {run.stage ? ` · ${run.stage}` : ""}
          </span>
          {onViewCode && (
            <button
              className="btn-tertiary"
              id={`view-fail-code-${shortId}`}
              onClick={() => onViewCode(runId)}
            >
              ▸ details
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function BuildCardDoneRow({
  run,
  runId,
  onViewCode,
}: {
  run: RunInfo;
  runId: string;
  onViewCode?: (id: string) => void;
}) {
  const shortId = runId.slice(-8).toUpperCase();
  // Extract stats from last validate step if available
  const validateStep = run.steps.find((s) => s.tool === "run_picogk");
  const stats = validateStep?.summaryJson as
    | { volumeCm3: number; watertight: boolean; durationMs?: number }
    | undefined;

  return (
    <div className="build-card-done-row">
      <span className="build-card-done-stat">✓ BUILT</span>
      {stats?.durationMs && (
        <span className="build-card-done-stat">
          {(stats.durationMs / 1000).toFixed(1)}s
        </span>
      )}
      {stats?.volumeCm3 !== undefined && (
        <span className="build-card-done-stat">
          VOL {stats.volumeCm3.toFixed(2)} cm³
        </span>
      )}
      {stats?.watertight !== undefined && (
        <span className="build-card-done-stat">
          WT {stats.watertight ? "✓" : "✗"}
        </span>
      )}
      <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
        {onViewCode && (
          <button
            className="btn-secondary"
            id={`frame-${shortId}`}
            style={{ padding: "4px 10px", fontSize: "11px" }}
            onClick={() => onViewCode(runId)}
          >
            FRAME
          </button>
        )}
        <button
          className="btn-secondary"
          id={`export-${shortId}`}
          style={{ padding: "4px 10px", fontSize: "11px" }}
          onClick={() => {
            /* Export handled in M6 */
          }}
        >
          EXPORT ▾
        </button>
      </div>
    </div>
  );
}
