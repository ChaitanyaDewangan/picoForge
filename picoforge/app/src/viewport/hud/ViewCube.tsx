// app/src/viewport/hud/ViewCube.tsx — UIUX §4
// Clickable orthographic cube showing current view orientation.
// Pure CSS — no Three.js in the HUD.

import type { ViewportStatus } from "../ViewportEngine.ts";
import type { ViewName } from "../ViewportEngine.ts";

interface Props {
  status: ViewportStatus | null;
  onView: (v: ViewName) => void;
}

const FACES: Array<{ view: ViewName; label: string; style: React.CSSProperties }> = [
  { view: "top",    label: "TOP",   style: { top:   "0%",  left: "33.3%", width: "33.3%", height: "33.3%" } },
  { view: "bottom", label: "BTM",   style: { top:  "66.6%", left: "33.3%", width: "33.3%", height: "33.3%" } },
  { view: "front",  label: "FRT",   style: { top:  "33.3%", left: "33.3%", width: "33.3%", height: "33.3%" } },
  { view: "back",   label: "BCK",   style: { top:  "33.3%", left: "66.6%", width: "33.3%", height: "33.3%" } },
  { view: "left",   label: "LFT",   style: { top:  "33.3%", left:   "0%",  width: "33.3%", height: "33.3%" } },
  { view: "right",  label: "RGT",   style: { top:  "33.3%", left: "66.6%", width: "33.3%", height: "33.3%" } },
  { view: "iso",    label: "ISO",   style: { top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "auto", height: "auto" } },
];

export function ViewCube({ status, onView }: Props) {
  return (
    <div
      id="viewcube"
      className="viewcube"
      aria-label="View cube — click a face to set view"
      title="Click face or use 0-6 keys"
    >
      {/* 3×3 grid of view buttons */}
      <div className="viewcube-grid">
        {/* Row 1: [   ] [TOP] [   ] */}
        <div />
        <ViewFaceBtn view="top"    label="TOP"  onView={onView} />
        <div />
        {/* Row 2: [LFT] [FRT] [RGT] */}
        <ViewFaceBtn view="left"  label="L"   onView={onView} />
        <ViewFaceBtn view="front" label="F"   onView={onView} style={{ border: "1px solid var(--amber-dim)" }} />
        <ViewFaceBtn view="right" label="R"   onView={onView} />
        {/* Row 3: [   ] [BTM] [   ] */}
        <div />
        <ViewFaceBtn view="bottom" label="BTM" onView={onView} />
        <div />
      </div>
      {/* ISO button below */}
      <button
        id="view-iso"
        className="viewcube-iso"
        onClick={() => onView("iso")}
        title="Isometric (key: 0)"
        aria-label="ISO view"
      >
        ◆
      </button>
      {/* Tier badge */}
      {status && (
        <div className="viewcube-tier micro-label" title={`GPU tier ${status.tier}`}>
          T{status.tier}
        </div>
      )}
    </div>
  );
}

function ViewFaceBtn({
  view, label, onView, style,
}: {
  view: ViewName; label: string; onView: (v: ViewName) => void; style?: React.CSSProperties;
}) {
  return (
    <button
      id={`view-${view}`}
      className="viewcube-face"
      onClick={() => onView(view)}
      title={`${view.charAt(0).toUpperCase() + view.slice(1)} view`}
      aria-label={`${view} view`}
      style={style}
    >
      {label}
    </button>
  );
}
