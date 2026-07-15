// app/src/viewport/hud/DROStrip.tsx — UIUX §2 + RENDERING §1
// DRO = Digital Read-Out — machine shop aesthetic, tabular mono numbers.

import type { ViewportStatus } from "../ViewportEngine.ts";

interface ArtifactMeta {
  stats?: { triangles?: number; volumeCm3?: number; watertight?: boolean };
}

interface Props {
  status: ViewportStatus | null;
  artifact: ArtifactMeta | null;
  projection: "ortho" | "persp";
  section: boolean;
  grid: boolean;
  turntable: boolean;
}

export function DROStrip({ status, artifact, projection, section, grid, turntable }: Props) {
  const stats = artifact?.stats;

  // Format numbers monospaced with fixed decimals
  const vol    = stats?.volumeCm3 != null ? `${stats.volumeCm3.toFixed(2)} cm³` : "— cm³";
  const tris   = status?.tris != null ? fmtNum(status.tris) : "—";
  const fps    = status ? `${status.fps.toFixed(0)} fps` : "—";
  const mode   = status?.mode === "pt" ? `PT·${status.spp} spp` : "RASTER";
  const wt     = stats?.watertight != null ? (stats.watertight ? "✓ SOLID" : "⚠ OPEN") : "—";

  return (
    <div id="dro-strip" className="dro-strip">
      {/* Left: geometry stats */}
      <div className="dro-group">
        <DROField id="dro-vol"  label="VOL"   value={vol} />
        <span className="dro-sep" />
        <DROField id="dro-tris" label="TRIS"  value={tris} />
        <span className="dro-sep" />
        <DROField id="dro-wt"   label="WATERTIGHT" value={wt}
          style={{ color: stats?.watertight === false ? "var(--err)" : undefined }} />
        {status?.lod && <DROBadge label="LOD" title="Display mesh decimated — full mesh used for measurements" />}
      </div>

      {/* Right: viewport state */}
      <div className="dro-group">
        <DROBadge label={projection.toUpperCase()} />
        <DROBadge label={mode} highlight={status?.mode === "pt"} />
        <DROBadge label={fps} />
        {section   && <DROBadge label="SECTION" highlight />}
        {grid      && <DROBadge label="GRID" />}
        {turntable && <DROBadge label="TURNTABLE" highlight />}
        {status?.tier && <DROBadge label={`TIER-${status.tier}`} />}
        {!status?.ptEnabled && <DROBadge label="RT OFF" />}
      </div>
    </div>
  );
}

function DROField({
  id, label, value, style,
}: { id?: string; label: string; value: string; style?: React.CSSProperties }) {
  return (
    <div className="dro-field" id={id} style={style}>
      <span className="dro-label micro-label">{label}</span>
      <span className="readout dro-value">{value}</span>
    </div>
  );
}

function DROBadge({ label, highlight, title }: { label: string; highlight?: boolean; title?: string }) {
  return (
    <span
      className={`dro-badge micro-label ${highlight ? "dro-badge--active" : ""}`}
      title={title}
    >
      {label}
    </span>
  );
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}
