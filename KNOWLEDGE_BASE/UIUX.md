# UIUX.md — Design System & Interface Specification

Design direction, stated once and enforced everywhere: **precision instrument, not SaaS dashboard.** The product's world is the machine shop and the measurement lab — CNC digital readouts, anodized fixtures, first-article inspection sheets. The UI borrows *that* vernacular: near-black surfaces, hairline rules, monospaced amber readouts, mechanical (stepped) state changes. Dark theme is the only theme in v1.

Base archetype: dark editorial/instrument (near-black + dirty white + one accent). Contrast element: functional-minimal structure (hairline rules, uppercase micro-labels). Maximum two archetypes; boldness is spent in exactly one place — the **Build Card / DRO readout system** (the signature element). Everything else stays quiet.

**Forbidden here** (hard rules for the implementer): drop shadows as depth (use borders + z-layering), border-radius other than 0/2 px, purple/violet anywhere, glassmorphism, icon-topped three-card rows, gradients except the two sanctioned ambient ones (§2.4), `Inter` as a lazy default, gray-500-style secondary text (use the token).

---

## 1. Layout — the split

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TOPBAR h44  ◆ PICOFORGE   PROJECT: FAN-IMPELLER ▾        ENGINE ● RT ● ⚙     │
├───────────────────────────────┬──────────────────────────────────────────────┤
│ CHAT PANE          40 %       ║ VIEWPORT PANE                          60 %  │
│ (min 420 px, drag 30–55 %)    ║                                              │
│ ┌───────────────────────────┐ ║   ┌──┐                            ┌────────┐ │
│ │ conversation scroll       │ ║   │⌂ │ toolbar (view/section/     │ VIEW   │ │
│ │  · user msg               │ ║   └──┘  material/showcase)        │ CUBE   │ │
│ │  · BRIEF CARD             │ ║                                   └────────┘ │
│ │  · BUILD CARD (live)      │ ║              [ 3D canvas ]                   │
│ │  · assistant text         │ ║                                              │
│ ├───────────────────────────┤ ║  ────────────── ground ──────────────        │
│ │ composer  [⏎ send]        │ ║ DRO ▸ VOL 42.71cm³ ⌀119.0 H24.0 WT✓ 0.35vx  │
│ └───────────────────────────┘ ║ ORTHO · ISO · TURNTABLE · RT 128spp          │
├───────────────────────────────┴──────────────────────────────────────────────┤
│ CONSOLE DRAWER (collapsed 28px / open 200px) — build & engine log, mono      │
└──────────────────────────────────────────────────────────────────────────────┘
```

Divider: 1 px `--line`, 6 px hit area, double-click resets to 40 %. Chat pane below 480 px viewport width (unsupported mobile) → single-pane with a CHAT/VIEW segmented switch; the app targets desktop.

---

## 2. Design tokens (`app/src/styles/tokens.css` — single source of visual truth)

```css
:root {
  /* palette — pulled from the machine-shop world; max 3 active per view */
  --bg-0:   #0D0E0C;   /* case black (warm, never #000) */
  --bg-1:   #141613;   /* panel */
  --bg-2:   #1B1E19;   /* raised: cards, drawer */
  --ink:    #E9E7E1;   /* dirty white text */
  --ink-2:  #98978C;   /* secondary — from palette, not gray-500 */
  --line:   #2A2D27;   /* hairline rules, 1px */
  --amber:  #FFB000;   /* THE accent: DRO amber. links, focus, live values, primary btn */
  --amber-dim: #8A6200;
  --ok:     #8FBF6A;   /* functional only: checks passed */
  --err:    #E5533D;   /* functional only: failures */
  /* type */
  --font-display: 'Space Grotesk', sans-serif;   /* wordmark, big numbers, empty states */
  --font-body:    'Instrument Sans', sans-serif; /* chat prose, controls */
  --font-mono:    'IBM Plex Mono', monospace;    /* code, logs, ALL measurements */
  /* geometry of the UI itself */
  --r: 2px;                 /* the only radius (0 for full-bleed bands) */
  --bw: 1px;                /* border width; 2px only for focus */
  --pad: 12px; --pad-lg: 20px;
  /* motion — mechanical, not bouncy */
  --t-micro: 120ms linear;                     /* hovers, toggles */
  --t-state: 240ms steps(3, end);              /* card state flips: detented, like a rotary switch */
  --t-cam:   480ms cubic-bezier(.2,.7,.2,1);   /* camera moves only */
}
@media (prefers-reduced-motion: reduce) { /* kill turntable, steps() → instant, no shimmer */ }
```

Type scale: display 44/1.05 600; section 20/1.2 600; body 15/1.6 400; **readout 13/1.0 mono 500 tracking .02em tabular-nums**; micro-label 10.5/1 UPPERCASE tracking .12em `--ink-2`. Numbers are always mono + tabular — a measurement never renders in the body face.

**2.4 Sanctioned ambience (only two):** viewport backdrop radial `radial-gradient(ellipse at 32% 22%, #1A1D18 0%, var(--bg-0) 72%)` (the "studio-light" wall); optional 4 %-opacity SVG grain on empty states only.

---

## 3. Components (Base UI mapping + custom)

Base UI (`@base-ui-components/react`) supplies behavior; all skins come from tokens. Used: Dialog (settings, wizard, confirm), Menu (project switcher, export), Tooltip (600 ms delay, mono content for values), Tabs (console: BUILD/ENGINE/EVENTS), ScrollArea (chat, logs), Slider (section plane, exposure), Switch (turntable, RT), Select (material, model), Field/Input (composer settings). Anything Base UI lacks (ViewCube, DRO, cards) is custom.

**Buttons.** Primary: `--amber` bg, `#141613` text, radius 2, no shadow; hover = bg `#FFC02E` + translate(0,-1px); active = translate(0,0). Secondary: transparent, 1 px `--line`, `--ink`; hover border `--ink-2`. Tertiary/inline: mono amber text `→ EXPORT STL`. Destructive: `--err` border, fills on hover.

**3.1 BRIEF CARD** — first-article sheet. Header row: micro-label `DESIGN BRIEF` + category chip + material. Two-column mono table `PARAMETER │ VALUE UNIT` (rationale as tooltip). Physics checks as rows: `TIP SPEED  11.3 m/s ≤ 30  ✓`(ok) / `✗`(err). Collapsed by default after acceptance to a one-line summary; click expands.

**3.2 BUILD CARD (signature element)** — a machine job traveler that lives in the assistant message and *is* the run UI:

```
┌ BUILD 01JX…9F ── attempt 1 ───────────────────────────────┐
│ ● BRIEF ─▶ ● CODE ─▶ ◉ COMPILE ─▶ ○ RUN ─▶ ○ VALIDATE     │   stage rail: filled=done,
│ ▮▮▮▮▮▮▮▮▮▮▮▯▯▯▯▯▯  62%   voxelizing blades…               │   pulsing=active (amber),
│ ▸ view code (v3, 214 lines)   ▸ log            ✕ cancel   │   steps(3) transitions
└───────────────────────────────────────────────────────────┘
→ done state header: ✓ BUILT · 4.2s · VOL 42.71 cm³ · WT ✓   [FRAME] [EXPORT ▾]
→ failed state: ✗ COMPILE ERROR (2/3) — retrying, one-line diagnostic, ▸ details
```

Code viewer opens in an overlay (mono 12.5, amber keyword tint only — one-accent syntax theme); diff between attempts available from the card. The card never disappears — it is the permanent record of the run in the transcript.

**3.3 DRO STRIP** (viewport bottom): live mono readout of the loaded artifact — `VOL … cm³ · ⌀/□ bbox · H … · WT ✓ · vx …`; values flash amber 240 ms on change (steps). Second line: `ORTHO|PERSP · view name · TURNTABLE|IDLE · RT n spp|RT OFF`. Clicking any value copies it.

**3.4 ViewCube** (top-right, 84 px): custom three.js inset scene — faces F/B/L/R/T + corners; hover face → amber edge; click → `--t-cam` tween; drag = orbit. Home icon beneath (ISO), `⊞/◇` ortho-persp toggle beside.

**3.5 Composer**: full-width field, 1 px border → amber on focus (2 px); placeholder rotates real prompts ("Build a 7-blade 120 mm fan impeller for PETG…"). Enter sends, Shift+Enter newline. While a run is live: input stays enabled, send becomes `QUEUE (1)`.

**3.6 ask_user options** render as 2–4 secondary buttons under the question (first = recommended, amber border); clicking sends the text as the user message.

**3.7 Error card**: `--err` left rule 2 px, plain-language line, mono detail collapsible, one concrete action button ("Retry with 0.5 mm voxels"). Errors never apologize and never dead-end.

**3.8 Console drawer**: tabs BUILD/ENGINE/EVENTS, mono 12, autoscroll-with-pin, filter input; row hover reveals `copy line`.

**3.9 Topbar**: wordmark `◆ PICOFORGE` (display, 15, tracking .04em) · project Menu · right cluster: ENGINE dot (● ok / ◐ degraded pulse / ○ down + tooltip), RT dot, settings gear.

---

## 4. Viewport interaction spec (feel = Fusion 360; engine details in RENDERING.md)

| Input | Action |
|---|---|
| LMB drag | Orbit around pivot |
| MMB drag (or RMB, or Shift+LMB) | Pan |
| Wheel | Zoom to cursor |
| Double-click surface | Set orbit pivot (raycast); 320 ms amber pivot ring, `--t-cam` recenters |
| Double-click empty | Reset pivot to part center |
| F | Frame part |
| O | Ortho ⇄ perspective (default **orthographic**, home = ISO az 45° el 35.26°) |
| 1/2/3/4/5/6 | Front/Back/Left/Right/Top/Bottom (tweened) |
| Space | Toggle turntable |
| S | Section mode: Slider appears (plane Z default; X/Y via toolbar), amber cap on cut |
| G | Grid toggle · M material cycle (alu / clay / resin) · Ctrl+E export menu |

Idle choreography: load → frame → **turntable ON by default** (0.15 rad/s yaw, resumes 10 s after interaction). Turntable OFF (Space or RT badge) + camera idle 600 ms → path tracing accumulates ("studio mode", spp counts up in DRO). Any input snaps back to raster instantly — interaction always wins.

Empty viewport state: faint grain, display-face line "NOTHING ON THE PLATE." + micro-label "DESCRIBE A PART IN THE CHAT — IT BUILDS HERE."; three starter prompt chips.

---

## 5. Global keyboard map

Ctrl+Enter send · Esc cancel run (confirm if >30 s in) / close overlay · Ctrl+K project switcher · Ctrl+J console · Ctrl+, settings · viewport keys per §4 (active when canvas hovered/focused). Every control reachable by Tab; focus ring 2 px amber offset 2; ViewCube arrow-key navigable. Contrast: ink on bg-0 ≈ 12:1, ink-2 ≈ 4.9:1, amber on bg-0 ≈ 8.9:1 — all AA+.

## 6. First-run wizard (Dialog, 3 steps, mono checklist aesthetic)

1 API KEY → paste, `TEST` calls a 1-token ping, stored to keyfile (never shown again). 2 ENGINE → auto-runs self-test cube with a mini build card; failure shows dotnet/NuGet fix hints. 3 GPU → 3 s probe, reports tier + chosen RT quality (adjustable later). Finish drops the user into a seeded example project whose first assistant message invites the fan prompt.

## 7. Copy rules

Sentence case prose; UPPERCASE only for micro-labels. Verbs on buttons say what happens: `Build again`, `Export STL`, `Set pivot`. Values with units, mono. Errors: what happened → why → the button that fixes it, in ≤ 2 lines. The agent's chat voice is specified in LLM_HARNESS §3; the chrome never talks ("Success!" toasts are banned — the DRO changing *is* the feedback).
