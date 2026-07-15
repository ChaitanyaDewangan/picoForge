// app/src/chat/ErrorCard.tsx — UIUX §3.7
// --err left rule, plain-language line, mono detail collapsible, action button.
// Errors never apologize and never dead-end.

import { useState } from "react";
import "./cards.css";

interface Props {
  code: string;
  message: string;
  detail?: string;
  /** Optional action button text + handler */
  action?: { label: string; onClick: () => void };
}

export function ErrorCard({ code, message, detail, action }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <div className="error-card" role="alert" aria-label={`Error: ${code}`}>
      <div className="error-card-title">{message}</div>

      {detail && (
        <>
          <button
            className="btn-tertiary"
            style={{ color: "var(--ink-2)", fontSize: "11px", alignSelf: "flex-start" }}
            onClick={() => setDetailOpen((o) => !o)}
            aria-expanded={detailOpen}
          >
            {detailOpen ? "▴ hide detail" : "▸ detail"}
          </button>
          {detailOpen && (
            <div className="error-card-detail">{detail}</div>
          )}
        </>
      )}

      {action && (
        <button
          className="btn-secondary"
          style={{ alignSelf: "flex-start", fontSize: "12px", padding: "5px 10px" }}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
