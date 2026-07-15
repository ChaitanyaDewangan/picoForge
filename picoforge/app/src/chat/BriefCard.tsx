// app/src/chat/BriefCard.tsx — UIUX §3.1
// First-article inspection sheet: params table + physics checks.
// Collapsed by default after acceptance → click expands.

import { useState } from "react";
import "./cards.css";

export interface BriefData {
  category?: string;
  material?: string;
  parameters: { name: string; value: string; unit?: string; rationale?: string }[];
  physicsChecks?: { label: string; value: string; limit: string; ok: boolean }[];
  accepted?: boolean;
}

interface Props {
  brief: BriefData;
}

export function BriefCard({ brief }: Props) {
  const [expanded, setExpanded] = useState(!brief.accepted);

  return (
    <div className="brief-card" aria-label="Design brief">
      {/* Header — always visible */}
      <div
        className="brief-card-header"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(ev) => ev.key === "Enter" && setExpanded((e) => !e)}
      >
        <span className="micro-label">DESIGN BRIEF</span>
        {brief.category && (
          <span className="brief-card-category">{brief.category}</span>
        )}
        {brief.material && (
          <span className="brief-card-material">{brief.material}</span>
        )}
        <span style={{ marginLeft: "auto", color: "var(--ink-2)", fontSize: "10px" }}>
          {expanded ? "▴" : "▾"}
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <>
          {/* Parameters table */}
          <table className="brief-card-table" aria-label="Parameters">
            <thead>
              <tr>
                <td className="micro-label">PARAMETER</td>
                <td className="micro-label">VALUE</td>
              </tr>
            </thead>
            <tbody>
              {brief.parameters.map((p, i) => (
                <tr key={i}>
                  <td title={p.rationale}>{p.name}</td>
                  <td>
                    {p.value}
                    {p.unit && (
                      <span style={{ color: "var(--ink-2)", marginLeft: 4 }}>{p.unit}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Physics checks */}
          {brief.physicsChecks && brief.physicsChecks.length > 0 && (
            <table className="brief-card-table" aria-label="Physics checks" style={{ marginTop: 0 }}>
              <thead>
                <tr>
                  <td className="micro-label">CHECK</td>
                  <td className="micro-label">VALUE ≤ LIMIT</td>
                  <td className="micro-label">PASS</td>
                </tr>
              </thead>
              <tbody>
                {brief.physicsChecks.map((c, i) => (
                  <tr key={i}>
                    <td>{c.label}</td>
                    <td>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        {c.value} ≤ {c.limit}
                      </span>
                    </td>
                    <td>
                      <span className={c.ok ? "brief-check-ok" : "brief-check-err"}>
                        {c.ok ? "✓" : "✗"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
