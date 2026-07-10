# RENDERING.md — Viewport & Ray-Traced Showcase Pipeline

Contract: **interaction always wins; fidelity fills the idle gaps.** The viewport is a single imperative class (`ViewportEngine.ts`) owning one WebGL2 context with two interchangeable render paths — a rasterizer for interaction and a progressive GPU path tracer for the studio look. React never renders 3D; it sends commands and reads a 4 Hz status struct.

Stack: three.js (pin a release; upgrade deliberately), `camera-controls` (yomotsu), `three-gpu-pathtracer` (gkjohnson) for path tracing on plain WebGL2 — runs on any consumer GPU, no RTX requirement (RTX-class cards simply converge faster), `meshoptimizer` (wasm) for display decimation, `STLLoader`/`GLTFLoader`. WebGPU: `settings.renderer.preferWebGPU` swaps in three's WebGPURenderer for the *raster* path only, silent fallback on failure; path tracing stays on the WebGL2 tracer in v1.

---

## 1. ViewportEngine public API (the whole surface React may touch)

```ts
class ViewportEngine {
  constructor(canvas: HTMLCanvasElement, opts: {tier: GpuTier});
  loadArtifact(a: {url:string; format:"glb"|"stl"; stats:GeomStats}): Promise<void>;
  setView(v: "iso"|"front"|"back"|"left"|"right"|"top"|"bottom", tween?: boolean): void;
  frame(tween?: boolean): void;
  setProjection(p: "ortho"|"persp"): void;
  setTurntable(on: boolean): void;
  setSection(s: null | {axis:"x"|"y"|"z"; offsetMm:number}): void;
  setMaterial(m: "alu"|"clay"|"resin"): void;
  capture(req: {view:ViewName|"current"; width:number; height:number; studio?:boolean}): Promise<Blob>;
  status(): {fps:number; mode:"raster"|"pt"; spp:number; tris:number; tier:GpuTier};
  resize(): void;  dispose(): void;
}
```

Idempotent, never throws to the caller (returns rejected promises with typed codes: `LOAD_PARSE`, `CONTEXT_LOST`, `CAPTURE_TIMEOUT`). `webglcontextlost` → `preventDefault`, veil UI, re-init on `restored`, reload last artifact, drop one GPU tier (SYS_DESIGN F9).

## 2. Geometry ingest

Prefer GLB (engine exports both; GLB ≈ 4× smaller, has normals). STL path: parse → `mergeVertices(1e-4)` → `computeVertexNormals` with 30° crease (toCreasedNormals). If `stats.triangles > 1.5 M`: keep full geometry for measurement raycasts, build a decimated **display** copy via meshoptimizer `simplify` to ~1 M (error bound 1e-3 · bbox diag); DRO shows `LOD` chip when active. Center check: trust engine placement (Z=0 seat); never re-transform, so measurements match exports.

## 3. Scene & studio lighting (the "showcase" look)

```
Scene
 ├─ Environment: RoomEnvironment → PMREMGenerator → scene.environment
 │    (procedural studio IBL — zero shipped assets, consistent speculars)
 ├─ Backdrop: fullscreen radial gradient (UIUX §2.4) rendered as scene.background
 │    via large inverted sphere w/ gradient shader (so PT sees it too)
 ├─ Key   : DirectionalLight  int 2.2, pos (1.2, -1.8, 2.4)·d, warm 5600K tint
 ├─ Fill  : DirectionalLight  int 0.6, (-2, -0.5, 1.2)·d, cool 7500K
 ├─ Rim   : DirectionalLight  int 1.4, (-0.6, 2.2, 1.8)·d
 ├─ Ground: 6·d radius disc, ShadowMaterial-style radial fade to transparent
 │    + contact shadow (blurred top-down depth render, classic drei technique)
 │    + optional 10 mm minor / 100 mm major GridHelper (toggle G, excluded from PT)
 └─ Part group (+ section-plane caps)
```

`d = bbox diagonal`; lights re-scale on load so a 6 mm screw and a 600 mm duct both sit in the same studio. Renderer: `outputColorSpace = SRGB`, `toneMapping = ACESFilmic`, exposure 1.0 (Slider in settings), `shadowMap.type = PCFSoft` (key light only, 2048).

Materials (MeshPhysicalMaterial): **alu** (default) color #C9CCD1, metalness .92, roughness .34, clearcoat .15 — reads as machined billet under the IBL; **clay** #8E8E88, metalness 0, roughness .85 (form review); **resin** #3A3D3B, metalness 0, roughness .45, clearcoat .6. Section caps: `--amber`, flat.

## 4. Camera model (Fusion-360 feel, ortho default)

`camera-controls` with both cameras pre-built: OrthographicCamera (home) and PerspectiveCamera (fov 35); `setProjection` swaps while preserving pivot + apparent size (match ortho zoom ↔ persp distance via `d = h/(2·tan(fov/2))`). Home = ISO az 45°, el 35.264°. Mappings per UIUX §4: rotate LMB, truck MMB/Shift-LMB, dolly wheel (`dollyToCursor: true`, infinity-dolly off). Double-click raycast (full-res geometry) → `setOrbitPoint` + 320 ms pivot ring sprite. View tweens via `setLookAt(..., true)` clamped to 480 ms. Near/far fitted per frame() to bbox (ortho: generous ±10·d) — no z-fighting at any scale.

Turntable: engine-side yaw of the *camera* azimuth (not the part — lighting stays fixed, reads as a display stand) at 0.15 rad/s; any control event pauses, resumes after 10 s (UIUX idle choreography), disabled under `prefers-reduced-motion`.

## 5. Two-path rendering & the mode ladder

```
             any input/turntable            camera idle 600ms AND turntable off
  RASTER  ◄────────────────────────  PT  ◄──────────────────────────────────── RASTER
  (60fps loop, shadows, MSAA)        (accumulates spp, DRO counts up)
```

Raster loop: on-demand rendering — render only on control change/turntable tick/resize (idle GPU ≈ 0 %). MSAA 4× via WebGL2 antialias; optional SSAO postpass tier-A only.

Path tracer (`WebGLPathTracer`): configured `bounces 5, filterGlossyFactor 0.25, tiles tier-dependent, renderScale tier-dependent, maxSamples 512 (settings)`. `setScene(scene, camera)` is the expensive step (BVH build) — run **only** when geometry/material/section/env changes, on a microtask after load, status flag `preparing RT`; camera-only changes call `updateCamera()` which just resets samples. Entry to PT: blend raster→PT over the first 16 spp (opacity ramp) so the user never sees the fireflies-from-black phase. Exit: instant. Section planes: the tracer honors clipping via rebuilt capped geometry (cheap CSG cap on the display mesh) rather than shader clip — correctness over cleverness.

## 6. GPU tiering (probe at first run, stored in settings, degradable at runtime)

Probe: offscreen 800² torus-knot scene, 60 raster frames + 40 PT samples; classify by ms/frame and spp/s.

| Tier | Raster | PT renderScale | tiles | target |
|---|---|---|---|---|
| A (≥ RTX-3060 / M-series Pro) | full res, SSAO, soft shadows | 1.0 | 2×2 | 256 spp < 15 s @1080p |
| B (mainstream laptop dGPU/iGPU) | full res, hard shadows | 0.75 | 3×3 | usable stills |
| C (weak iGPU) | dynamic res 0.6–1.0 keeping ≥ 30 fps | PT disabled | — | raster only, RT badge "OFF" |

Runtime watchdog: raster < 24 fps for 3 s → drop res scale; PT < 2 spp/s → drop tier for session. All silent except the DRO badge.

## 7. Capture service (feeds the `capture_viewport` tool and user exports)

Tool capture: offscreen render target 1024² — **raster path** (deterministic, < 300 ms): temporarily set requested canonical view on a cloned camera, render once with shadows, `readPixels` → PNG blob → WS reply. Never engages PT (latency) and never disturbs the on-screen camera. User "Showcase export" (toolbar): modal with size (up to 4096²) + `studio` toggle → runs PT to `min(1024 spp, 30 s)` with progress, saves via artifact endpoint.

## 8. Performance & memory budget

One geometry + one decimated copy resident max (dispose on replace: geometry, textures, PT BVH — `pathTracer.dispose()` on artifact swap). Target heap for viewport < 600 MiB at 1 M tris. `deno task bench:viewport` (Playwright) asserts: load-1M-tri < 1.2 s, orbit ≥ 55 fps tier-A, PT reaches 64 spp < 6 s tier-A, no context-loss on 20 rapid artifact swaps, zero leaked WebGL objects (`renderer.info` deltas).
