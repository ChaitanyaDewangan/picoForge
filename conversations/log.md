07/15/2026 09:50 AM
M3 Server + DB milestone complete

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
