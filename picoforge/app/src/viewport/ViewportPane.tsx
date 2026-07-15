// app/src/viewport/ViewportPane.tsx — RENDERING §1 + UIUX §4
// React owns only canvas sizing, HUD overlays, and command dispatch.
// ViewportEngine is imperative and owns the WebGL context.

import { useEffect, useRef, useState, useCallback } from "react";
import { ViewportEngine, type ViewName, type MaterialId, type ViewportStatus, type GpuTier } from "./ViewportEngine.ts";
import { ViewCube } from "./hud/ViewCube.tsx";
import { DROStrip } from "./hud/DROStrip.tsx";
import { ViewportToolbar } from "./hud/ViewportToolbar.tsx";
import "./ViewportPane.css";

// ─── GPU tier probe (RENDERING §6) ───────────────────────────────────────────

function probeGpuTier(): GpuTier {
  const saved = localStorage.getItem("picoforge.gpu.tier");
  if (saved === "A" || saved === "B" || saved === "C") return saved;
  // Quick heuristic from WebGL renderer string
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) return "C";
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  if (!dbg) return "B";
  const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string;
  const isDiscrete = /nvidia|amd|radeon|geforce|rtx|gtx|rx\s\d|intel\s(arc|xe)/i.test(renderer);
  const tier: GpuTier = isDiscrete ? "A" : "B";
  localStorage.setItem("picoforge.gpu.tier", tier);
  return tier;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ViewportPaneProps {
  /** Called when engine becomes available — parent can call loadArtifact etc. */
  onEngineReady?: (engine: ViewportEngine) => void;
  /** Artifact to immediately load after mount */
  artifact?: { url: string; format: "glb" | "stl"; stats: { triangles?: number; volumeCm3?: number; watertight?: boolean } } | null;
}

// ─── ViewportPane ─────────────────────────────────────────────────────────────

export function ViewportPane({ onEngineReady, artifact }: ViewportPaneProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const engineRef  = useRef<ViewportEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<ViewportStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [projection, setProjection] = useState<"ortho" | "persp">("ortho");
  const [material, setMaterial] = useState<MaterialId>("alu");
  const [turntable, setTurntable] = useState(false);
  const [section, setSection] = useState(false);
  const [grid, setGrid] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  // Init engine once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tier = probeGpuTier();
    const engine = new ViewportEngine(canvas, { tier });
    engineRef.current = engine;
    onEngineReady?.(engine);

    // 4 Hz status poll (RENDERING §1)
    const statusId = setInterval(() => {
      setStatus(engine.status());
    }, 250);

    // Context-loss veil
    canvas.addEventListener("webglcontextlost", () => setContextLost(true));
    canvas.addEventListener("webglcontextrestored", () => setContextLost(false));

    // Double-click → frame (pivot reset)
    const onDblClick = () => { engine.frame(true); };
    canvas.addEventListener("dblclick", onDblClick);

    return () => {
      clearInterval(statusId);
      canvas.removeEventListener("dblclick", onDblClick);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Notify parent
  useEffect(() => {
    if (engineRef.current) onEngineReady?.(engineRef.current);
  }, [onEngineReady]);

  // Load artifact when prop changes
  useEffect(() => {
    if (!artifact || !engineRef.current) return;
    setLoading(true);
    engineRef.current.loadArtifact(artifact)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [artifact]);

  // ResizeObserver — call engine.resize() when container resizes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => engineRef.current?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keyboard shortcuts (UIUX §4)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const eng = engineRef.current;
      if (!eng) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case "f": eng.frame(true); break;
        case "1": eng.setView("front", true); break;
        case "2": eng.setView("back", true); break;
        case "3": eng.setView("left", true); break;
        case "4": eng.setView("right", true); break;
        case "5": eng.setView("top", true); break;
        case "6": eng.setView("bottom", true); break;
        case "0": eng.setView("iso", true); break;
        case "p": {
          const np = projection === "ortho" ? "persp" : "ortho";
          eng.setProjection(np);
          setProjection(np);
          break;
        }
        case "t": {
          const nt = !turntable;
          eng.setTurntable(nt);
          setTurntable(nt);
          break;
        }
        case "g": setGrid((g) => !g); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [projection, turntable]);

  const handleSetView = useCallback((v: ViewName) => {
    engineRef.current?.setView(v, true);
  }, []);

  const handleMaterial = useCallback((m: MaterialId) => {
    engineRef.current?.setMaterial(m);
    setMaterial(m);
  }, []);

  const handleProjection = useCallback((p: "ortho" | "persp") => {
    engineRef.current?.setProjection(p);
    setProjection(p);
  }, []);

  const handleTurntable = useCallback((on: boolean) => {
    engineRef.current?.setTurntable(on);
    setTurntable(on);
  }, []);

  const handleSection = useCallback((on: boolean) => {
    setSection(on);
    engineRef.current?.setSection(
      on ? { axis: "z", offsetMm: 0 } : null,
    );
  }, []);

  const handleCapture = useCallback(async () => {
    const blob = await engineRef.current?.capture({ view: "current", width: 1920, height: 1080 });
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `picoforge-capture-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const isEmpty = !artifact && !loading;

  return (
    <div id="viewport-pane" className="viewport-pane" ref={containerRef}>
      {/* WebGL canvas */}
      <canvas
        ref={canvasRef}
        className="viewport-canvas"
        aria-label="3D geometry viewport"
      />

      {/* Context-loss veil */}
      {contextLost && (
        <div className="viewport-veil">
          <div className="viewport-veil-text">
            <span>⚠</span>
            <span>GPU CONTEXT LOST — RECOVERING…</span>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="viewport-loading">
          <div className="viewport-loading-bar" />
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="viewport-empty">
          <div className="viewport-empty-title">NOTHING ON THE PLATE.</div>
          <div className="viewport-empty-sub micro-label">DESCRIBE A PART IN CHAT — IT BUILDS HERE.</div>
          <div className="viewport-empty-hint micro-label" style={{ marginTop: 8, color: "var(--amber-dim)" }}>
            KEYBOARD: F FRAME · 0 ISO · P PROJ · T TURNTABLE · G GRID
          </div>
        </div>
      )}

      {/* Toolbar (top-right) */}
      <ViewportToolbar
        projection={projection}
        material={material}
        turntable={turntable}
        section={section}
        grid={grid}
        onProjection={handleProjection}
        onMaterial={handleMaterial}
        onTurntable={handleTurntable}
        onSection={handleSection}
        onGrid={setGrid}
        onFrame={() => engineRef.current?.frame(true)}
        onCapture={handleCapture}
        onSetView={handleSetView}
      />

      {/* ViewCube (top-left corner) */}
      <ViewCube status={status} onView={handleSetView} />

      {/* DRO strip (bottom) */}
      <DROStrip
        status={status}
        artifact={artifact ?? null}
        projection={projection}
        section={section}
        grid={grid}
        turntable={turntable}
      />
    </div>
  );
}
