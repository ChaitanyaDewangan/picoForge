// app/src/panels/SettingsDialog.tsx — UIUX §3.9 + §6
// Uses <dialog> natively (ponytail rung 4). No modal manager library.

import { useEffect, useRef, useState } from "react";
import "./SettingsDialog.css";

interface Settings {
  model: string;
  maxRepairAttempts: number;
  voxelCellCapWarn: number;
  voxelCellCapHard: number;
  runTimeoutS: number;
  telemetry: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialSettings?: Partial<Settings>;
}

const MODELS = ["claude-sonnet-4-6", "claude-opus-4-5", "claude-haiku-4-5"];

const DEFAULTS: Settings = {
  model: "claude-sonnet-4-6",
  maxRepairAttempts: 3,
  voxelCellCapWarn: 20_000_000,
  voxelCellCapHard: 40_000_000,
  runTimeoutS: 120,
  telemetry: false,
};

export function SettingsDialog({ open, onClose, initialSettings }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [settings, setSettings] = useState<Settings>({ ...DEFAULTS, ...initialSettings });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");

  // Native <dialog> open/close
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Close on Escape (dialog natively handles this, wire onClose)
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => onClose();
    el.addEventListener("close", handler);
    return () => el.removeEventListener("close", handler);
  }, [onClose]);

  // Close on backdrop click
  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      onClose();
    }
  }

  async function testApiKey() {
    if (!apiKeyInput.trim()) return;
    setTestStatus("testing");
    try {
      // Ping via server proxy (M6 wires this; for now just pass-through)
      const res = await fetch("/api/settings/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: apiKeyInput }),
      });
      setTestStatus(res.ok ? "ok" : "fail");
    } catch {
      setTestStatus("fail");
    }
    setTimeout(() => setTestStatus("idle"), 3000);
  }

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { ...settings };
      if (apiKeyInput.trim()) body.apiKey = apiKeyInput;
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* logged server-side */
    }
    setSaving(false);
  }

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  return (
    <dialog
      ref={dialogRef}
      id="settings-dialog"
      className="settings-dialog"
      aria-label="Settings"
      onClick={handleDialogClick}
    >
      <div className="settings-panel">
        {/* Header */}
        <div className="settings-header">
          <span className="micro-label">SETTINGS</span>
          <button
            id="settings-close"
            className="btn-tertiary"
            aria-label="Close settings"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="settings-body">
          {/* API Key section */}
          <section className="settings-section">
            <div className="settings-section-title micro-label">API KEY</div>
            <div className="settings-row">
              <input
                id="api-key-input"
                type="password"
                className="settings-input"
                placeholder="sk-ant-…  (write-only, never echoed)"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                aria-label="Anthropic API key"
                autoComplete="off"
              />
              <button
                id="api-key-test"
                className="btn-secondary settings-test-btn"
                onClick={testApiKey}
                disabled={!apiKeyInput.trim() || testStatus === "testing"}
              >
                {testStatus === "testing" ? "…" : testStatus === "ok" ? "✓ OK" : testStatus === "fail" ? "✗ FAIL" : "TEST"}
              </button>
            </div>
          </section>

          {/* Model */}
          <section className="settings-section">
            <div className="settings-section-title micro-label">MODEL</div>
            <select
              id="model-select"
              className="settings-select"
              value={settings.model}
              onChange={(e) => set("model", e.target.value)}
              aria-label="Model"
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </section>

          {/* Engine limits */}
          <section className="settings-section">
            <div className="settings-section-title micro-label">ENGINE LIMITS</div>
            <div className="settings-grid">
              <SettingsField
                id="max-repair"
                label="Max repair attempts"
                value={settings.maxRepairAttempts}
                min={1} max={6}
                onChange={(v) => set("maxRepairAttempts", v)}
              />
              <SettingsField
                id="timeout"
                label="Run timeout (s)"
                value={settings.runTimeoutS}
                min={30} max={600}
                onChange={(v) => set("runTimeoutS", v)}
              />
              <SettingsField
                id="voxel-warn"
                label="Voxel cap warn (M)"
                value={Math.round(settings.voxelCellCapWarn / 1_000_000)}
                min={1} max={100}
                onChange={(v) => set("voxelCellCapWarn", v * 1_000_000)}
              />
              <SettingsField
                id="voxel-hard"
                label="Voxel cap hard (M)"
                value={Math.round(settings.voxelCellCapHard / 1_000_000)}
                min={1} max={200}
                onChange={(v) => set("voxelCellCapHard", v * 1_000_000)}
              />
            </div>
          </section>

          {/* Telemetry */}
          <section className="settings-section">
            <div className="settings-section-title micro-label">TELEMETRY</div>
            <label className="settings-toggle-row" htmlFor="telemetry-toggle">
              <input
                id="telemetry-toggle"
                type="checkbox"
                className="settings-toggle"
                checked={settings.telemetry}
                onChange={(e) => set("telemetry", e.target.checked)}
              />
              <span>Send anonymous usage data (local only, never uploaded)</span>
            </label>
          </section>
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <button id="settings-save" className="btn-primary" onClick={save} disabled={saving}>
            {saved ? "✓ Saved" : saving ? "Saving…" : "Save"}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </dialog>
  );
}

function SettingsField({
  id, label, value, min, max, onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="settings-field">
      <label htmlFor={id} className="settings-field-label micro-label">{label}</label>
      <input
        id={id}
        type="number"
        className="settings-input settings-number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
