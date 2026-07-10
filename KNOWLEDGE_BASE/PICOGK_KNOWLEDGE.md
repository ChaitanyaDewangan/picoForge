# PICOGK_KNOWLEDGE.md — Kernel API, Kit Helpers, Recipes, Physics

Dual purpose: (a) implementation spec for `PicoForge.Kit` and the docs pipeline, (b) source content that `deno task setup` chunks into `kb_docs` so the agent's `search_docs` tool serves it at runtime. Sections marked **[KB]** are ingested verbatim.

**Ground truth policy.** PicoGK evolves (v2.2.0 is current as of mid-2026, distributed via NuGet package `PicoGK`, native runtime 26.x / OpenVDB 13). Signatures below are tiered: **[C]** confirmed from release notes, **[H]** high-confidence canonical usage, **[V]** verify. None of this ends up hand-written in the runtime prompt: `tools/DumpApi` reflects over the installed `PicoGK.dll` + `Kit.dll` at setup time and emits `picogk_api.json`, which generates both the analyzer whitelist and the prompt API card. If a signature drifted, DumpApi output wins and this doc gets a PR. Deep reference: https://picogk.org and https://github.com/leap71/PicoGK (headless usage discussed in repo discussion #30; headless supported since v1.6, scoped `Library` instances since v2.0).

---

## 1. [KB] PicoGK mental model

PicoGK ("peacock") is a voxel-based geometry kernel. You build **Voxels** — a signed-distance field on a sparse grid (OpenVDB) — by rasterizing three source representations into it, then combining fields with booleans and offsets. Voxels are always closed/watertight by construction; meshing them yields a printable surface. Everything is millimeters.

The three sources:
1. **Lattice** — beams and spheres (`AddBeam(vecA, vecB, fRadA, fRadB, bRoundCap)`, `AddSphere`). A beam with flat caps is a cylinder; with round caps, a capsule. Fastest way to pipes, struts, rods.
2. **Mesh** — explicit triangles (`nAddVertex`, `nAddTriangle`; quads supported since v1.7.7). Must be closed and consistently wound to voxelize correctly. Use Kit lofts — don't hand-roll.
3. **Implicit** — any object with `float fSignedDistance(in Vector3 vec)` (`IImplicit`; `IBoundedImplicit` adds bounds **[C]**), voxelized within a `BBox3`. The door to gyroids and math-defined surfaces.

Field operations (mutating): `BoolAdd`, `BoolSubtract`, `BoolIntersect` — plus operators `+ - &` on Voxels **[C v1.7.5]**. `Offset(fMM)` grows (+) or erodes (−) the whole solid; two opposed offsets are the fillet/round workhorse (Kit wraps this). `Voxels.bIsEmpty` **[C v2.0]**, trim to a `BBox3` **[C v1.7.7]**, slice extraction along axes **[C v2.0]**, `bRayCastToSurface` / `bGetClosestPointOnSurface` **[C v1.3–1.5]**, Gaussian/Median/Mean smoothing (experimental) **[C v1.5]**.

Lifecycle: classic pattern is `Library.Go(fVoxelSizeMM, TaskFn)` **[H]**; v2 supports instantiating a scoped `Library` object without the global/viewer **[C v2.0]** — the Sandbox uses whichever headless form DumpApi finds, wrapped once in `Runner.cs` so generated code never touches lifecycle. Mesh out: `Voxels → mshAsMesh()` **[H]**, `Mesh.SaveToStlFile(path)` **[H]**, transform mesh by `Matrix4x4` **[C v1.7]**, VDB round-trip via `VdbFile` **[H]**, CLI slice export for SLM **[C v1.7]**. Log/progress via `ILog`/`IProgress` interfaces **[C v2.0]** — wired to `ctx.Log`/`ctx.Progress`.

Performance intuition for the agent: cost scales with *surface area / voxel size²*, memory with occupied narrow-band cells. Booleans are cheap; huge implicit bounds are not — always pass tight `BBox3`. Draft at voxel = maxDim/200, finalize at /400.

---

## 2. [KB] Coordinate & authoring conventions (enforced by validators)

Millimeters everywhere. **Z up.** Part sits on build plate: `bbox.min.Z == 0 ± 1 voxel`, centered in X/Y. Rotors spin about +Z. Angles in code: radians (`MathF`); in briefs/UI: degrees. Right-handed. One `Voxels` returned; union sub-bodies before return.

---

## 3. PicoGK API card (compressed form the model sees — generated, this is the template)

```
Voxels:  new() | new(Lattice) | new(Mesh) | new(IImplicit, BBox3)
  .BoolAdd(v) .BoolSubtract(v) .BoolIntersect(v)   (also: a+b, a-b, a&b)
  .Offset(fMM)  .bIsEmpty()  .CalculateProperties(out fVolCm3, out BBox3)
  .mshAsMesh()  .voxMeshShell? .voxLatticeBeam?      // per DumpApi
  .bRayCastToSurface(...)  .bGetClosestPointOnSurface(...)
Lattice: new()  .AddBeam(vA,vB,rA,rB,bRoundCap)  .AddSphere(c,r)
Mesh:    new()  .nAddVertex(Vector3)->int  .nAddTriangle(i,j,k)
         static Mesh.mshFromStlFile(s)  .SaveToStlFile(s)  transform(Matrix4x4)
IImplicit { float fSignedDistance(in Vector3 p); }   BBox3(vecMin, vecMax)
Vector3/Matrix4x4 = System.Numerics.  MathF for trig.
```

(Exact member list, arities, and any renames come from `picogk_api.json`; the card generator truncates doc-comments to ≤ 12 words each.)

---

## 4. `PicoForge.Kit` — the golden helper library (implement in M1, this is the contract)

Namespace `PicoForge.Kit`, static class `Kit` + records. Every function: pure w.r.t. inputs (except documented mutators), argument-validated with actionable exceptions ("fTipR (60) must exceed fHubR (60)"), covered by a golden-volume test.

```csharp
// ---------- primitives (ctx supplies voxel size) ----------
Voxels voxBox(Ctx c, Vector3 vMin, Vector3 vMax);
Voxels voxBoxCentered(Ctx c, Vector3 vCenter, Vector3 vSize);
Voxels voxCylinder(Ctx c, Vector3 vA, Vector3 vB, float fR);        // flat caps (lattice beam, bRound=false)
Voxels voxCapsule (Ctx c, Vector3 vA, Vector3 vB, float fR);
Voxels voxSphere  (Ctx c, Vector3 vCenter, float fR);
Voxels voxCone    (Ctx c, Vector3 vBase, Vector3 vTip, float fRBase, float fRTip);
Voxels voxTube    (Ctx c, Vector3 vA, Vector3 vB, float fROuter, float fWall);

// ---------- profiles & sweeps ----------
Voxels voxExtrudeZ(Ctx c, IReadOnlyList<Vector2> aPolyXY, float fZ0, float fZ1); // closed CCW poly
Voxels voxRevolve (Ctx c, IReadOnlyList<Vector2> aProfileRZ, float fDeg = 360);  // about +Z, R>=0
Voxels voxSweepCircle(Ctx c, IReadOnlyList<Vector3> aPath, float fR);            // capsule chain = smooth pipe
Mesh   mshLoft(IReadOnlyList<IReadOnlyList<Vector3>> aRings, bool bCapEnds = true);
       // equal-count closed rings, consistent winding → watertight side quads + fan caps

// ---------- transforms & patterns ----------
Mesh   mshTransform(Mesh m, Matrix4x4 mat);                          // returns new mesh
Voxels voxPolarPatternZ(Ctx c, Mesh mOne, int nCount);               // rotate-copy about +Z, voxelize union
Voxels voxLinearPattern(Ctx c, Mesh mOne, Vector3 vStep, int nCount);

// ---------- modifiers (mutate in place, return same for chaining) ----------
Voxels Shell(Voxels v, float fWallMM);          // hollow inward: v = v - erode(v, wall)
Voxels FilletClose(Voxels v, float fR);         // Offset(+r) then Offset(-r): rounds CONCAVE junctions
Voxels RoundOpen  (Voxels v, float fR);         // Offset(-r) then Offset(+r): rounds convex edges, kills spikes < 2r

// ---------- 2D & airfoil ----------
List<Vector2> aCircle(float fR, int n = 64);
List<Vector2> aRoundedRect(float fW, float fH, float fCornerR, int nPerCorner = 8);
List<Vector2> aNaca4(string sCode, float fChord, int n = 61, bool bBluntTE = true);
       // closed CCW polygon, LE at origin, chord along +X, thickness in Y

// ---------- rotor high-level (the fan/turbine fast path) ----------
record BladeSpec(
  float fHubR, float fTipR, int nSections,          // nSections >= 4
  Func<float,float>  fChordAt,                      // rNorm 0..1 -> chord mm
  Func<float,float>  fBetaDegAt,                    // blade angle from rotation plane
  Func<float,string> sNacaAt,                       // e.g. _ => "4409"
  float fRootExtendMM = 1.5f);                      // sink root below hub surface for clean union
Mesh   mshAxialBlade(BladeSpec s);                  // one blade, stacked at 40% chord, span along +radial
Voxels voxAxialRotor(Ctx c, BladeSpec s, int nBlades,
                     float fHubR, float fHubZ0, float fHubZ1,
                     float fBoreR = 0, float fFilletR = 0);
       // = hub(revolve) + polar(blade) - bore, FilletClose(fFilletR), rests at Z=0

// ---------- implicit toolbox ----------
IImplicit impGyroid(float fCellMM, float fWallMM);                 // |sinX cosY + sinY cosZ + sinZ cosX| <= t
IImplicit impBox(Vector3 vMin, Vector3 vMax);  IImplicit impUnion/impSubtract(...);
Voxels voxFromImplicit(Ctx c, IImplicit i, BBox3 bounds);

// ---------- stats (harness uses the same code) ----------
GeomStats oStats(Ctx c, Voxels v);   // volumeCm3, areaCm2, bboxMm, triangles, watertight, minWallProbeMm
```

Implementation notes: `voxRevolve` = triangulate profile into a fan of loft rings around Z (or implicit distance-to-profile, implementer's choice — golden tests pin volumes either way). `mshLoft` is the single most failure-prone routine in the codebase: property-test with random convex rings (watertight check + volume vs analytic cylinder/cone). `minWallProbeMm`: binary-search erosion `t` where `volume(erode(v, t/2)) / volume(v)` first drops below 0.15 → report `t`.

Golden tests (Kit.Tests, tolerance 2 % at voxel = R/50): sphere 4/3πR³; tube π(Ro²−Ri²)L; extrude area×h; revolve of rectangle = washer; loft(circle,circle) = cylinder; rotor: watertight, nBlades-fold symmetry (slice contour count at mid-span == nBlades), bore diameter within 2 voxels.

---

## 5. [KB] Physics formula pack (the agent's checkable math)

Constants: air ρ=1.20 kg/m³, ν=1.5e-5 m²/s. Convert mm→m before physics; report mm.

**Rotation** ω = 2πN/60 [rad/s] · U(r) = ωr · tip speed limit: ≤ 30 m/s quiet desktop, ≤ 80 hobby, ≤ 0.7·Mach hard.
**Axial fan sizing** Q = c_a·π(r_t²−r_h²) → axial velocity c_a. Blade angle (free vortex, no inlet swirl): **β(r) = atan(c_a / U(r))** + incidence 3–5°; hub-to-tip ratio 0.25–0.45; solidity σ(r)=n·c(r)/(2πr) in 0.3–1.3 (≤1.6 at hub). Euler pressure rise Δp_th = ρ_air·U·c_u2 (design c_u2 ≈ 0.2–0.4·U at mid). Fan laws: Q∝N, Δp∝N², P∝N³.
**Centrifugal blade stress** (straight-blade bound) σ_c = ρ_m·ω²·(r_t²−r_h²)/2 → SF = σ_yield/σ_c ≥ 3.
**Reynolds** Re = W·c/ν, W = √(c_a²+U²). Re < 5e4 → low-Re regime: prefer cambered 4-digit (44xx) thin sections, expect modest efficiency.
**Cantilever bracket** σ = 6FL/(b h²) (rect section), δ = FL³/(3EI), I = b h³/12 → SF ≥ 2, δ ≤ span/250 typical.
**Thin-wall pressure** σ_hoop = p·r/t → SF ≥ 4.
**Shaft torsion** τ = 16T/(π d³) → SF ≥ 3.
**Gear tooth (Lewis)** σ = F_t/(m·b·Y), Y≈0.30 (20 teeth, 20° involute); module m ≥ what passes with SF 2.
**Channels** D_h = 4A/P; laminar below Re≈2300.
**Print minimums** wall ≥ max(material.MinWallMM, 3·voxel); unsupported overhang ≤ 50° from vertical for FDM (note in brief risks otherwise).

Worked example the KB carries (so the agent can pattern-match): *120 mm PETG case fan, 1800 rpm, target 0.05 m³/s* → ω 188.5, U_tip 11.3 m/s ✓, c_a 4.9 m/s, β 55° hub→23° tip, n=7, chord 26→18 mm, σ_hub 1.6 / σ_tip 0.33, σ_c 0.07 MPa vs 50 → SF≈700 ✓, Re≈1.3e4 → NACA 4409, Δp_th≈19 Pa.

---

## 6. [KB] Recipe: axial fan impeller (canonical, ships as `recipes/rotor_fan`)

Brief-driven reference implementation the model should imitate (and may nearly copy):

```csharp
public static class Design {
  public static Voxels voxBuild(Ctx ctx) {
    float fHubR  = ctx.oParams.f("hub_radius");      // 18
    float fTipR  = ctx.oParams.f("tip_radius");      // 59.5 (0.5 tip clearance in 120 frame)
    int   nB     = ctx.oParams.n("blade_count");     // 7
    float fCa    = ctx.oParams.f("axial_velocity");  // 4.9  m/s
    float fOmega = ctx.oParams.f("omega");           // 188.5 rad/s
    float fHubH  = ctx.oParams.f("hub_height");      // 24
    float fBore  = ctx.oParams.f("bore_radius");     // 2.5

    var spec = new BladeSpec(
      fHubR: fHubR - 0.5f, fTipR: fTipR, nSections: 7,
      fChordAt: r => 26f - 8f * r,
      fBetaDegAt: r => {                              // free vortex + 4° incidence
        float fRad = (fHubR + r * (fTipR - fHubR)) / 1000f;
        return MathF.Atan2(fCa, fOmega * fRad) * 180f / MathF.PI + 4f; },
      sNacaAt: _ => "4409");

    ctx.Log($"rotor: {nB} blades, beta {spec.fBetaDegAt(0):F0}->{spec.fBetaDegAt(1):F0} deg");
    Voxels vox = Kit.voxAxialRotor(ctx, spec, nB,
        fHubR: fHubR, fHubZ0: 0, fHubZ1: fHubH, fBoreR: fBore, fFilletR: 1.2f);
    return vox;                                      // Kit guarantees Z=0 seating
  }
}
```

Variations the KB documents alongside: ducted shroud ring (`voxTube` unioned at tip radius + 0.5), swept/raked blades (`fRakeDeg` extension), balancing bore pattern.

## 7. [KB] Recipe stubs (each ~1 page in KB with formulas + Kit composition)

`bracket` — L-bracket: two `voxBoxCentered` + gusset `voxExtrudeZ(triangle)`, bolt holes `voxCylinder` subtracted, `FilletClose(3)`; size h from bending check. `enclosure` — outer `voxBox` → `Shell(wall)` → lid split by `voxBox` subtract at parting Z; bosses `voxCylinder` + pilot holes. `heat_exchanger` — shell `voxTube` & `voxFromImplicit(impGyroid(cell, wall), boundsInside)` intersect, headers via revolve; report relative density. `gear` — spur via extruded involute polyline helper `aInvolute(m, z, α)` (Kit optional extra; brief must pass Lewis). `duct` — centerline polyline → `voxSweepCircle` outer − inner. `lattice_part` — conformal strut fill: `Lattice` beams on a grid clipped by a skin mesh, `voxMeshShell` skin + lattice core.

## 8. Materials table (Kit `Material` presets; brief validator source of truth)

| id | ρ g/cm³ | σ_yield MPa | E GPa | min wall mm | max °C | notes |
|---|---|---|---|---|---|---|
| PLA | 1.24 | 45 | 3.5 | 1.0 | 55 | stiff, brittle, low temp |
| PETG | 1.27 | 50 | 2.1 | 1.0 | 75 | default; tough, easy |
| ABS | 1.05 | 40 | 2.0 | 1.2 | 95 | warps; enclosures |
| PA12 (MJF/SLS) | 1.01 | 48 | 1.7 | 0.8 | 120 | functional nylon |
| Resin (tough) | 1.15 | 55 | 2.6 | 0.6 | 60 | detail parts |
| Al 6061-T6 | 2.70 | 276 | 68.9 | 0.8 | 200+ | CNC/metal AM |
| SS 316L | 8.00 | 205 | 193 | 0.5 | 400+ | LPBF |

## 9. Docs ingestion pipeline (`deno task setup`, module `server/kb/ingest.ts`)

Chunk this file's [KB] sections + `picogk_api.json` (one chunk per type) + each recipe file (300–500 tokens, overlap 50) → `kb_docs` with `source` tags → FTS triggers populate `kb_fts`. Idempotent by content hash. Optionally append user-dropped PDFs/MD from `~/PicoForge/kb/` (same chunker). Test: query "blade angle free vortex" must rank §5 in top-2; "boolean subtract voxels" must rank the API chunk first.
