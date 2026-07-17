// app/src/panels/SettingsDialog.tsx — UIUX §3.9 + §6
// Uses <dialog> natively (ponytail rung 4). No modal manager library.
// Fetches available models from /api/models, saves key to keystore via PUT.

import { useEffect, useRef, useState } from "react";
import "./SettingsDialog.css";

interface ModelInfo { id: string; label: string; maxTokens: number; }

interface Settings {
  model: string;
  maxOutputTokens: number;
  maxRepairAttempts: number;
  voxelCellCapWarn: number;
  voxelCellCapHard: number;
  runTimeoutS: number;
  telemetry: boolean;
}

const DEFAULTS: Settings = {
  model: "claude-sonnet-4-6",
  maxOutputTokens: 4096,
  maxRepairAttempts: 3,
  voxelCellCapWarn: 20_000_000,
  voxelCellCapHard: 40_000_000,
  runTimeoutS: 120,
  telemetry: false,
};

// Fallback model list (shown while /api/models loads)
const FALLBACK_MODELS: ModelInfo[] = [
  { id: "claude-sonnet-4-5",  label: "Claude Sonnet 4.5",       maxTokens: 8192 },
  { id: "claude-sonnet-4-6",  label: "Claude Sonnet 4.6",       maxTokens: 8192 },
  { id: "claude-haiku-4-5",   label: "Claude Haiku 4.5 (fast)", maxTokens: 4096 },
  { id: "claude-opus-4-5",    label: "Claude Opus 4.5 (slow)",  maxTokens: 8192 },
];

interface Props {
  open: boolean;
  onClose: () => void;
  initialSettings?: Partial<Settings>;
}

export function SettingsDialog({ open, onClose, initialSettings }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [settings, setSettings] = useState<Settings>({ ...DEFAULTS, ...initialSettings });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [models, setModels] = useState<ModelInfo[]>(FALLBACK_MODELS);

  // Fetch available models from server
  useEffect(() => {
    if (!open) return;
    fetch("/api/models")
      .then((r) => r.json())
      .then((j: { models?: ModelInfo[] }) => { if (j.models?.length) setModels(j.models); })
      .catch(() => {/* use fallback */});
    // Also load current settings + provider info
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j: { settings?: Partial<Settings>; provider?: { hasApiKey?: boolean; apiBaseUrl?: string } }) => {
        if (j.settings) setSettings((s) => ({ ...s, ...j.settings }));
        if (j.provider?.apiBaseUrl) setBaseUrlInput(j.provider.apiBaseUrl);
      })
      .catch(() => {});
  }, [open]);

  // Native <dialog> open/close
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => onClose();
    el.addEventListener("close", handler);
    return () => el.removeEventListener("close", handler);
  }, [onClose]);

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
      const body: Record<string, string> = { key: apiKeyInput };
      if (baseUrlInput.trim()) body.baseUrl = baseUrlInput;
      const res = await fetch("/api/settings/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      if (baseUrlInput !== undefined) body.apiBaseUrl = baseUrlInput.trim() || "";
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaved(true);
        setApiKeyInput(""); // clear after save
        setBaseUrlInput(""); // clear after save
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      /* server-side logged */
    }
    setSaving(false);
  }

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  // Max tokens for currently selected model
  const selectedModel = models.find((m) => m.id === settings.model);
  const maxForModel = selectedModel?.maxTokens ?? 8192;

  return (
    <dialog
      ref={dialogRef}
      id="settings-dialog"
      className="settings-dialog"
      aria-label="Settings"
      onClick={handleDialogClick}
    >
      <div className="settings-panel">
        <div className="settings-header">
          <span className="micro-label">SETTINGS</span>
          <button id="settings-close" className="btn-tertiary" aria-label="Close settings" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          {/* API Key */}
          <section className="settings-section">
            <div className="settings-section-title micro-label">API KEY & ENDPOINT</div>
            <div className="settings-row">
              <input
                id="api-key-input"
                type="password"
                className="settings-input"
                placeholder="sk-…  (write-only, stored in ~/PicoForge/secret.env)"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                aria-label="API key"
                autoComplete="off"
              />
              <button
                id="api-key-test"
                className="btn-secondary settings-test-btn"
                onClick={testApiKey}
                disabled={!apiKeyInput.trim() || testStatus === "testing"}
              >
                {testStatus === "testing" ? "…"
                  : testStatus === "ok" ? "✓ OK"
                  : testStatus === "fail" ? "✗ FAIL"
                  : "TEST"}
              </button>
            </div>
            <div style={{ marginTop: 8 }}>
              <label className="micro-label" htmlFor="base-url-input" style={{ color: "var(--ink-2)", display: "block", marginBottom: 4 }}>
                BASE URL (leave empty for direct Anthropic)
              </label>
              <input
                id="base-url-input"
                type="url"
                className="settings-input"
                placeholder="https://opencode.ai/api/v1  or custom proxy URL"
                value={baseUrlInput}
                onChange={(e) => setBaseUrlInput(e.target.value)}
                aria-label="API base URL"
                autoComplete="off"
              />
            </div>
            <div className="micro-label" style={{ color: "var(--ink-2)", marginTop: 4 }}>
              Key is stored locally only. Use a base URL for OpenCode, OpenRouter, or other proxies.
            </div>
          </section>

          {/* Model */}
          <section className="settings-section">
            <div className="settings-section-title micro-label">MODEL</div>
            <select
              id="model-select"
              className="settings-select"
              value={settings.model}
              onChange={(e) => {
                const m = models.find((x) => x.id === e.target.value);
                set("model", e.target.value);
                // Auto-clamp output tokens to new model's max
                if (m && settings.maxOutputTokens > m.maxTokens) {
                  set("maxOutputTokens", m.maxTokens);
                }
              }}
              aria-label="Model"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            {selectedModel && (
              <div className="micro-label" style={{ color: "var(--ink-2)", marginTop: 4 }}>
                Max output: {selectedModel.maxTokens.toLocaleString()} tokens
              </div>
            )}
          </section>

          {/* Token limits */}
          <section className="settings-section">
            <div className="settings-section-title micro-label">TOKEN LIMITS (subscription-safe)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label className="settings-field-label micro-label" htmlFor="max-output-tokens">
                Max output tokens per turn: <span style={{ color: "var(--amber)" }}>{settings.maxOutputTokens.toLocaleString()}</span>
              </label>
              <input
                id="max-output-tokens"
                type="range"
                min={512}
                max={maxForModel}
                step={256}
                value={settings.maxOutputTokens}
                onChange={(e) => set("maxOutputTokens", Number(e.target.value))}
                style={{ accentColor: "var(--amber)", width: "100%" }}
                aria-label="Max output tokens"
              />
              <div className="micro-label" style={{ color: "var(--ink-2)" }}>
                512 ▸▸ {maxForModel.toLocaleString()} · lower = fewer tokens consumed per call
              </div>
            </div>
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

        <div className="settings-footer">
          <button id="settings-save" className="btn-primary" onClick={save} disabled={saving}>
            {saved ? "✓ Saved" : saving ? "Saving…" : "Save settings"}
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
  id: string; label: string; value: number; min: number; max: number; onChange: (v: number) => void;
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
