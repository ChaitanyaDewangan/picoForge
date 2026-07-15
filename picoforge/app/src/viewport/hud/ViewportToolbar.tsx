// app/src/viewport/hud/ViewportToolbar.tsx — UIUX §4
// Right-side vertical toolbar: view presets, material, projection, turntable, section, capture.

import type { ViewName, MaterialId } from "../ViewportEngine.ts";

interface Props {
  projection: "ortho" | "persp";
  material: MaterialId;
  turntable: boolean;
  section: boolean;
  grid: boolean;
  onProjection: (p: "ortho" | "persp") => void;
  onMaterial: (m: MaterialId) => void;
  onTurntable: (on: boolean) => void;
  onSection: (on: boolean) => void;
  onGrid: (on: boolean) => void;
  onFrame: () => void;
  onCapture: () => void;
  onSetView: (v: ViewName) => void;
}

export function ViewportToolbar({
  projection, material, turntable, section, grid,
  onProjection, onMaterial, onTurntable, onSection, onGrid,
  onFrame, onCapture, onSetView,
}: Props) {
  return (
    <div id="viewport-toolbar" className="viewport-toolbar" role="toolbar" aria-label="Viewport controls">
      <TBDivider />

      {/* Frame */}
      <TBtn id="tb-frame" label="⊞" title="Frame (F)" onClick={onFrame} />

      <TBDivider />

      {/* View presets */}
      <TBtn id="tb-iso"    label="◇"  title="ISO (0)"      onClick={() => onSetView("iso")} />
      <TBtn id="tb-front"  label="■"  title="Front (1)"    onClick={() => onSetView("front")} />
      <TBtn id="tb-top"    label="▣"  title="Top (5)"      onClick={() => onSetView("top")} />

      <TBDivider />

      {/* Projection */}
      <TBtn
        id="tb-proj"
        label={projection === "ortho" ? "⊙" : "◉"}
        title={`Projection: ${projection} (P)`}
        active={projection === "persp"}
        onClick={() => onProjection(projection === "ortho" ? "persp" : "ortho")}
      />

      <TBDivider />

      {/* Materials */}
      <TBtn id="tb-mat-alu"   label="M" title="Alu material"   active={material === "alu"}   onClick={() => onMaterial("alu")} />
      <TBtn id="tb-mat-clay"  label="C" title="Clay material"  active={material === "clay"}  onClick={() => onMaterial("clay")} />
      <TBtn id="tb-mat-resin" label="R" title="Resin material" active={material === "resin"} onClick={() => onMaterial("resin")} />

      <TBDivider />

      {/* Turntable */}
      <TBtn
        id="tb-turntable"
        label="↻"
        title="Turntable (T)"
        active={turntable}
        onClick={() => onTurntable(!turntable)}
      />

      {/* Section */}
      <TBtn
        id="tb-section"
        label="⧈"
        title="Section view"
        active={section}
        onClick={() => onSection(!section)}
      />

      {/* Grid */}
      <TBtn
        id="tb-grid"
        label="⊞"
        title="Grid (G)"
        active={grid}
        onClick={() => onGrid(!grid)}
      />

      <TBDivider />

      {/* Capture */}
      <TBtn id="tb-capture" label="⬡" title="Capture PNG (1920×1080)" onClick={onCapture} />
    </div>
  );
}

function TBtn({
  id, label, title, active, onClick,
}: { id: string; label: string; title: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      id={id}
      className={`vp-tb-btn ${active ? "vp-tb-btn--active" : ""}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function TBDivider() {
  return <div className="vp-tb-divider" />;
}
