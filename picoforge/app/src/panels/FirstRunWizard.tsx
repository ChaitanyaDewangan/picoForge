// app/src/panels/FirstRunWizard.tsx — UIUX §6
// 3-step wizard: API Key → Engine self-test → GPU probe.
// Uses <dialog> natively, mono checklist aesthetic.

import { useEffect, useRef, useState } from "react";
import "./FirstRunWizard.css";

type Step = "api-key" | "engine" | "gpu";

interface Props {
  open: boolean;
  onComplete: () => void;
}

export function FirstRunWizard({ open, onComplete }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>("api-key");

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      id="first-run-wizard"
      className="wizard-dialog"
      aria-label="First-run setup"
    >
      <div className="wizard-panel">
        {/* Stepper */}
        <div className="wizard-stepper">
          {(["api-key", "engine", "gpu"] as Step[]).map((s, i) => {
            const steps: Step[] = ["api-key", "engine", "gpu"];
            const idx = steps.indexOf(step);
            const done = i < idx;
            const active = i === idx;
            return (
              <div key={s} className={`wizard-step ${done ? "done" : active ? "active" : ""}`}>
                <span className="wizard-step-dot">{done ? "✓" : i + 1}</span>
                <span className="wizard-step-label micro-label">
                  {s === "api-key" ? "API KEY" : s === "engine" ? "ENGINE" : "GPU"}
                </span>
                {i < 2 && <span className="wizard-step-line" />}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="wizard-content">
          {step === "api-key" && (
            <ApiKeyStep onNext={() => setStep("engine")} />
          )}
          {step === "engine" && (
            <EngineStep onNext={() => setStep("gpu")} />
          )}
          {step === "gpu" && (
            <GpuStep onComplete={onComplete} />
          )}
        </div>
      </div>
    </dialog>
  );
}

type Provider = "anthropic" | "opencode" | "custom";

const PROVIDER_INFO: Record<Provider, { label: string; placeholder: string; baseUrl?: string; desc: string }> = {
  anthropic: {
    label: "Anthropic (Direct)",
    placeholder: "sk-ant-api03-…",
    desc: "Use your Anthropic API key directly with api.anthropic.com.",
  },
  opencode: {
    label: "OpenCode (Zen / Go)",
    placeholder: "sk-…",
    baseUrl: "https://opencode.ai/api/v1",
    desc: "Use your OpenCode subscription key. Routes through OpenCode's proxy.",
  },
  custom: {
    label: "Custom Proxy",
    placeholder: "sk-…  or custom key",
    desc: "Use any Anthropic-compatible proxy endpoint (OpenRouter, Cloudflare, etc.)",
  },
};

function ApiKeyStep({ onNext }: { onNext: () => void }) {
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [failMsg, setFailMsg] = useState("");

  const info = PROVIDER_INFO[provider];
  // Resolved base URL: preset for opencode, user-entered for custom, empty for anthropic
  const resolvedBase = provider === "opencode"
    ? (baseUrl || info.baseUrl!)
    : provider === "custom"
      ? baseUrl
      : "";

  async function test() {
    if (!key.trim()) return;
    setStatus("testing");
    setFailMsg("");
    try {
      const body: Record<string, string> = { key };
      if (resolvedBase) body.baseUrl = resolvedBase;
      const res = await fetch("/api/settings/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setStatus("ok");
        // Also persist the key + base URL immediately on success
        const saveBody: Record<string, string> = { apiKey: key };
        if (resolvedBase) saveBody.apiBaseUrl = resolvedBase;
        else saveBody.apiBaseUrl = "";
        await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(saveBody),
        });
      } else {
        setStatus("fail");
        setFailMsg(
          res.status === 401
            ? "Invalid key — check it and try again"
            : `Connection failed (HTTP ${res.status})`,
        );
      }
    } catch {
      setStatus("fail");
      setFailMsg("Network error — is the server running?");
    }
  }

  return (
    <div className="wizard-step-content">
      <div className="wizard-step-title">API Provider & Key</div>
      <p className="wizard-step-desc">
        PicoForge calls Claude to design geometry. Choose your provider and enter your API key.
        Your key is stored locally in{" "}
        <code>~/PicoForge/secret.env</code> and never logged.
      </p>

      {/* Provider selector */}
      <div className="wizard-provider-row">
        {(["anthropic", "opencode", "custom"] as Provider[]).map((p) => (
          <button
            key={p}
            className={`btn-secondary wizard-provider-btn ${provider === p ? "btn-secondary--active" : ""}`}
            style={provider === p ? { borderColor: "var(--amber)" } : {}}
            onClick={() => {
              setProvider(p);
              setStatus("idle");
              setFailMsg("");
              // Pre-fill opencode base URL
              if (p === "opencode") setBaseUrl(PROVIDER_INFO.opencode.baseUrl!);
              else if (p === "anthropic") setBaseUrl("");
            }}
          >
            {PROVIDER_INFO[p].label}
          </button>
        ))}
      </div>

      <div className="micro-label" style={{ color: "var(--ink-2)" }}>
        {info.desc}
      </div>

      {/* Base URL (shown for opencode + custom) */}
      {provider !== "anthropic" && (
        <div>
          <label className="micro-label" htmlFor="wizard-base-url" style={{ color: "var(--ink-2)", display: "block", marginBottom: 4 }}>
            BASE URL
          </label>
          <input
            id="wizard-base-url"
            type="url"
            className="wizard-input"
            placeholder="https://proxy.example.com/v1"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            aria-label="API base URL"
            autoComplete="off"
          />
        </div>
      )}

      {/* API Key */}
      <div className="wizard-input-row">
        <input
          id="wizard-api-key"
          type="password"
          className="wizard-input"
          placeholder={info.placeholder}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          aria-label="API key"
          autoComplete="off"
          autoFocus
        />
        <button
          id="wizard-test-key"
          className="btn-secondary"
          disabled={!key.trim() || status === "testing" || (provider !== "anthropic" && !resolvedBase)}
          onClick={test}
        >
          {status === "testing" ? "…" : status === "ok" ? "✓ OK" : status === "fail" ? "✗ FAIL" : "TEST"}
        </button>
      </div>

      {failMsg && (
        <div className="micro-label" style={{ color: "var(--red, #f44)", marginTop: 2 }}>
          {failMsg}
        </div>
      )}

      <div className="wizard-checklist">
        <CheckItem ok={status === "ok"} pending={status === "testing"} label={
          resolvedBase
            ? `1-token ping to ${new URL(resolvedBase).hostname}`
            : "1-token ping to api.anthropic.com"
        } />
      </div>

      <button
        id="wizard-next-1"
        className="btn-primary wizard-next"
        disabled={status !== "ok"}
        onClick={onNext}
      >
        Next →
      </button>
    </div>
  );
}

// ─── Step 2: Engine ───────────────────────────────────────────────────────────

function EngineStep({ onNext }: { onNext: () => void }) {
  const [status, setStatus] = useState<"idle" | "running" | "ok" | "fail">("idle");
  const [detail, setDetail] = useState("");

  async function runTest() {
    setStatus("running");
    setDetail("building test cube…");
    try {
      const res = await fetch("/api/selftest", { method: "POST" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (json.ok) {
        setStatus("ok");
        setDetail("watertight cube generated in <6 s");
      } else {
        setStatus("fail");
        setDetail(json.error ?? "Engine test failed");
      }
    } catch (e) {
      setStatus("fail");
      setDetail(String(e));
    }
  }

  return (
    <div className="wizard-step-content">
      <div className="wizard-step-title">Engine Self-Test</div>
      <p className="wizard-step-desc">
        PicoForge runs a local .NET engine (PicoGK) to build geometry. This step
        compiles a test cube to verify the engine is installed and working.
      </p>

      <button
        id="wizard-run-engine-test"
        className="btn-secondary"
        disabled={status === "running" || status === "ok"}
        onClick={runTest}
      >
        {status === "idle" ? "Run self-test" : status === "running" ? "Building…" : status === "ok" ? "✓ Passed" : "✗ Failed — Retry"}
      </button>

      {detail && (
        <div className="wizard-detail readout" style={{ marginTop: 12 }}>{detail}</div>
      )}

      <div className="wizard-checklist">
        <CheckItem ok={status === "ok"} pending={status === "running"} label="Engine responds to ping" />
        <CheckItem ok={status === "ok"} pending={status === "running"} label="Test cube builds watertight" />
      </div>

      {status === "fail" && (
        <div style={{ marginTop: 8 }}>
          <p className="wizard-hint micro-label">
            Ensure .NET 8 SDK is installed and{" "}
            <code>picoforge\engine\bin\Release\forge-engine.exe</code> exists.
            Run <code>deno task setup</code> to rebuild.
          </p>
        </div>
      )}

      <button
        id="wizard-next-2"
        className="btn-primary wizard-next"
        disabled={status !== "ok"}
        onClick={onNext}
      >
        Next →
      </button>
    </div>
  );
}

// ─── Step 3: GPU ──────────────────────────────────────────────────────────────

function GpuStep({ onComplete }: { onComplete: () => void }) {
  const [tier, setTier] = useState<"A" | "B" | "C" | null>(null);

  useEffect(() => {
    // Quick WebGL capability probe (no API call needed)
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) { setTier("C"); return; }
    const dbgInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbgInfo ? gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : "";
    const isDiscrete = /nvidia|amd|radeon|geforce|rtx|gtx/i.test(renderer as string);
    setTier(isDiscrete ? "A" : "B");
  }, []);

  const tierDesc: Record<string, string> = {
    A: "Discrete GPU — path tracing up to 256 spp @ 1080p",
    B: "Integrated GPU — path tracing at reduced quality (64 spp)",
    C: "No WebGL2 — raster only (no path tracing)",
  };

  return (
    <div className="wizard-step-content">
      <div className="wizard-step-title">GPU Detection</div>
      <p className="wizard-step-desc">
        The viewport uses WebGL raster + an optional path tracer for studio renders.
      </p>

      <div className="wizard-checklist">
        <CheckItem ok={tier !== null} pending={tier === null} label={`GPU tier: ${tier ?? "…"}`} />
        {tier && <CheckItem ok label={tierDesc[tier] ?? ""} />}
      </div>

      <div className="wizard-step-title" style={{ fontSize: "12px", marginTop: 16 }}>
        Renderer quality
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["A", "B", "C"] as const).map((t) => (
          <button
            key={t}
            className={`btn-secondary ${tier === t ? "btn-secondary--active" : ""}`}
            style={tier === t ? { borderColor: "var(--amber)" } : {}}
            onClick={() => setTier(t)}
          >
            Tier {t}
          </button>
        ))}
      </div>

      <button
        id="wizard-finish"
        className="btn-primary wizard-next"
        onClick={onComplete}
        disabled={tier === null}
      >
        Start building ◆
      </button>
    </div>
  );
}

// ─── Shared checklist item ────────────────────────────────────────────────────

function CheckItem({ ok, pending, label }: { ok: boolean; pending?: boolean; label: string }) {
  return (
    <div className="wizard-check-item">
      <span
        className="wizard-check-icon"
        style={{ color: ok ? "var(--ok)" : pending ? "var(--amber)" : "var(--ink-2)" }}
      >
        {ok ? "✓" : pending ? "◌" : "○"}
      </span>
      <span className="wizard-check-label">{label}</span>
    </div>
  );
}
