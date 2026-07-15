07/15/2026 10:33 AM
M4 App shell + chat milestone complete

Built:
- app/src/ws/client.ts — WebSocket client with reconnect, seq-based resume (ECONNREFUSED expected until M6)
- app/src/state/chatStore.ts — useReducer chat store mapping all WS events (chat.delta/block/done, run.status, step.*, geometry.ready)
- app/src/chat/cards.css — BuildCard, BriefCard, ErrorCard, ask-user options, code viewer overlay styles
- app/src/chat/BuildCard.tsx — Stage rail (5 stages), progress bar, logs, done/failed footers, cancel button
- app/src/chat/BriefCard.tsx — Param table + physics checks, collapsed by default after acceptance
- app/src/chat/ErrorCard.tsx — Red left-rule, collapsible detail, action button
- app/src/chat/MessageList.tsx + MessageList.css — Message bubbles, block dispatch, streaming cursor, auto-scroll, empty state with starter chips
- app/src/chat/Composer.tsx + Composer.css — Auto-growing textarea, placeholder rotation, QUEUE badge during runs
- app/src/panels/ConsoleDrawer.tsx + css — BUILD/ENGINE/EVENTS tabs, autoscroll-with-pin, text filter, row copy
- app/src/panels/SettingsDialog.tsx + css — Native <dialog>, API key (write-only), model, engine limits grid
- app/src/panels/FirstRunWizard.tsx + css — 3-step: API key test, engine self-test, GPU probe
- app/src/dev/cards.tsx — /dev/cards fixture page, all card states
- app/src/App.tsx — Full shell: draggable split, keyboard shortcuts (Ctrl+J/,/Esc), all components wired
- app/src/main.tsx — /dev/cards route + CSS imports

Visual verification: Both /dev/cards and / load correctly with dark/amber theme.
TypeScript: clean (tsc --noEmit exit 0)
React key warning: fixed (display:contents span wrapper)

---
07/15/2026 09:50 AM
M3 Server + DB milestone complete
...


Built:
- server/db/repo/projects.ts — Project CRUD repository
- server/db/repo/conversations.ts — Conversation repository  
- server/db/repo/messages.ts — Message repository with content block schema
- server/db/repo/runs.ts — Runs, run_steps, code_versions, artifacts repos in one file
- server/db/repo/settings.ts — Settings repository with schema defaults
- server/db/repo/kb.ts — Knowledge base FTS5 repository
- server/http/ws.ts — WebSocket hub with ring-buffer resume (500 events), backpressure, ping/pong
- server/http/staticFiles.ts — Artifact file serving with ETag, Range requests
- server/http/router.ts — Full REST router (projects CRUD, conversations, messages, artifacts, settings, WS, files, self-test)
- server/main.ts — Updated boot with orphan repair + supervisor
- server/db/tests/repos.test.ts — 14 new tests (repo CRUD, orphan repair, withTx rollback, EXPLAIN checks)

Fixed:
- db.ts: Use import.meta.dirname for Windows-compatible migrations path
- db.ts: Add all() to DB statement interface for multi-row queries
- domain/events.ts: nonneg() → nonnegative() (correct zod API)
- All repos: switched list queries from .get() to .all()

Test count: 49 → 63 passing, 0 failing
All gates: fmt ✅ lint ✅ typecheck ✅ tests ✅
