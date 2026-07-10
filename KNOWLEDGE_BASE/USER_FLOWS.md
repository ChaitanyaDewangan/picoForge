# USER_FLOWS.md — End-to-End Flows (with failure branches)

Each flow lists actor steps → system events (WS frames from SYS_DESIGN §3.3) → persistence. These are the acceptance scripts for AGENTS milestones; E2E tests replay them.

## F0 · First run
Launch → wizard (UIUX §6): key test (`POST /api/settings` → 1-token ping) → engine self-test (`POST /api/selftest` streams a mini build card; writes nothing to projects) → GPU probe (tier → settings). Exit: seeded "Example — Fan Impeller" project open. **Branches:** bad key → inline `--err` under field, retry in place. dotnet missing → step 2 shows install command + "recheck". Probe fails → tier C, RT badge OFF, continue.

## F1 · Create project
Ctrl+K → "New project" → name + material + envelope (defaults PETG, 220³) → `POST /api/projects` → conversation auto-created → composer focused. Empty viewport state shows starter chips.

## F2 · "Build a turbine for my fan" — the golden path (full trace)

| # | Actor / system | Events & writes |
|---|---|---|
| 1 | User sends "Build a quiet 120 mm fan impeller, PETG, 1800 rpm" | WS `user.message` → `messages` row; run row `queued` |
| 2 | Harness starts turn | `run.status{briefing}`; build card appears, stage rail lit |
| 3 | Model → `search_docs("axial fan blade angle")` | `step.start/done(tool.search_docs)`; card shows "consulting recipes" |
| 4 | Model → `submit_design_brief` (7 blades, β 55→23°, checks pass) | validator accepts → `runs.brief_json`, Brief Card renders; `run.status{codegen}` |
| 5 | Model → `run_picogk(code v1)` | `code_versions` row; `run.status{compiling}` → engine.compile ok (280 ms) |
| 6 | Engine executes sandbox | `run.status{executing}`; `step.log` lines stream to card + console; `run.progress` drives the bar |
| 7 | Ladder L3 passes | `run.status{validating→rendering}`; artifacts stl/glb/vdb + report rows |
| 8 | Client loads GLB | `geometry.ready{stats}` → ViewportEngine.loadArtifact → frame → turntable; DRO flashes values |
| 9 | Model reads stats, replies 4 sentences (numbers + one caveat) | `chat.delta…chat.done`; run `done`, card collapses to ✓ header |

Elapsed target: < 60 s wall including model tokens; < 15 s system time (SYS_DESIGN §8).

## F3 · Compile error → silent repair
…step 5 returns `COMPILE_ERROR` (e.g. hallucinated member). Card flips `✗ COMPILE (1/3) — fixing` in `--err` for 240 ms then amber; tool_result carries diagnostics + repair hint (LLM_HARNESS §8); model resubmits full file (`notes:"renamed voxBool→BoolAdd"`); v2 chains `parent_id`; proceeds as F2. User never had to act. Transcript keeps both attempts diff-able.

## F4 · OOM / timeout → resource repair
Executing child killed at RSS cap → `OOM{rss, cellEstimate, suggestedVoxel}`. Card: "ran out of headroom — retrying at 0.5 mm voxels". Attempt 2 passes brief-merge (voxel_size_mm updated) → success. Timeout variant identical with elapsed/progress payload.

## F5 · Geometry validation fail
`BELOW_MIN_WALL{measured 0.62, min 1.0, sliceZ 14}` → repair adjusts trailing-edge thickness → pass. Card exposes the measured numbers; Brief Card check row turns from ✗ to ✓ on the retry.

## F6 · Budget exhausted → agency handoff
Three compile failures → orchestrator injects stop instruction → model calls `ask_user("Couldn't get the swept shroud stable. Options:", ["Plain ring shroud (recommended)","No shroud","Try again with coarser 0.6 mm voxels"])` → option buttons render; click sends as user message; new run starts. Run row `failed{code}` but the conversation flows on.

## F7 · Iterate: "make the blades 20 % thicker and add a 6 mm bore"
Model submits brief **delta** (thickness param ×1.2, bore_radius 3) → merged brief re-validated → code regenerated reading `ctx.Params` → run → new artifact replaces viewport content; DRO volume flash shows the change; previous geometry remains one click away on its old build card (`FRAME` re-loads it).

## F8 · Export
User: "give me the STL" → model `export_artifact{stl}` → `exports/` file + artifact row → chat shows `→ IMPELLER_V2.STL · 4.1 MB · saved to project exports` with reveal-in-folder link (server `open` via allowed run permission). Toolbar Ctrl+E does the same without the model.

## F9 · Cancel
Esc (or card ✕) during `executing` → confirm if > 30 s in → WS `run.cancel` → engine.cancel kills child (< 300 ms) → run `cancelled`; card shows `— CANCELLED`, composer ready. Queued message (if any) starts next.

## F10 · Engine dies mid-run
Supervisor heartbeat misses → restart (backoff); orphan run → `failed{ENGINE_LOST}`; card explains "the geometry engine restarted — rebuilding automatically", harness auto-retries **once** (fresh sandbox); topbar ENGINE dot ◐ during backoff. Second death within the same run → error card with log path, no auto-retry.

## F11 · API unreachable / 429
`anthropic.ts` retries 3× (jittered backoff) with card status "model busy, retrying (2/3)". Exhausted → error card "Claude is unreachable — check connection or key" + Retry button (replays the same user message, new run). Nothing else in the app degrades; viewport and history fully usable offline.

## F12 · Reload / resume
Browser refresh → REST hydrate (last 50 messages, runs, latest done artifact) → viewport restores last geometry + saved camera home; WS reconnect with `resume=seq` replays anything missed. A run that finished while disconnected appears completed with its geometry — no ghosts.

## F13 · Inspect & section
User: "is the hub wall thick enough?" → model `inspect_geometry{ops:[wall_min, section z@12]}` → replies with measured numbers + the slice image inline; user presses S and drags the plane to eyeball it; DRO unchanged (section is view-only).

## F14 · Showcase render
Toolbar SHOWCASE → modal (2048², studio ✓) → turntable pauses, PT progress ring to 1024 spp/30 s cap → PNG saved as artifact + offered for download; viewport returns to prior mode. (Same path powers the model's `capture_viewport`, minus PT.)
