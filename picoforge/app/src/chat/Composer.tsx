// app/src/chat/Composer.tsx — UIUX §3.5
// Full-width textarea, amber focus ring (2px), placeholder rotation.
// Enter sends, Shift+Enter newline. Live run: send becomes QUEUE (n).

import { useState, useRef, useCallback, useEffect } from "react";
import "./Composer.css";

const PLACEHOLDERS = [
  "Build a 7-blade 120 mm fan impeller for PETG…",
  "Design a bracket with 4 M6 holes, 2 mm wall thickness…",
  "Create a parametric gear, module 1.5, 24 teeth, 20° PA…",
  "Make a Voronoi lattice infill, 40% density, 100 mm cube…",
];

interface Props {
  onSend: (text: string) => void;
  /** Number of messages queued behind a live run (0 = run idle) */
  pendingQueue?: number;
  disabled?: boolean;
}

export function Composer({ onSend, pendingQueue = 0, disabled = false }: Props) {
  const [text, setText] = useState("");
  const [phIdx, setPhIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Rotate placeholder every 6 s
  useEffect(() => {
    const id = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 6000);
    return () => clearInterval(id);
  }, []);

  // Auto-grow textarea (max 5 lines ≈ 140px)
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [text]);

  const submit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    // Reset height
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [text, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  const isRunning = pendingQueue > 0;
  const sendLabel = isRunning ? `QUEUE (${pendingQueue + 1})` : "⏎";

  return (
    <div id="composer" className="composer">
      <textarea
        id="composer-input"
        ref={textareaRef}
        className="composer-input"
        value={text}
        placeholder={PLACEHOLDERS[phIdx]}
        aria-label="Message composer — Enter to send, Shift+Enter for newline"
        rows={1}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        id="composer-send"
        className={`btn-primary composer-send ${isRunning ? "composer-send--queue" : ""}`}
        disabled={disabled || !text.trim()}
        onClick={submit}
        aria-label={isRunning ? "Queue message" : "Send message"}
        title={isRunning ? "A run is active — message will be queued" : "Send (Enter)"}
      >
        {sendLabel}
      </button>
    </div>
  );
}
