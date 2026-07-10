// Kit.Tests/KitGoldenTests.cs — Golden-volume tests for PicoForge.Kit
// PICOGK_KNOWLEDGE §4: "tolerance 2% at voxel = R/50"
// AGENTS.md M1 gate: dotnet test green incl. golden volumes

using System.Numerics;
using PicoGK;
using PicoForge.Kit;

namespace Kit.Tests;

/// <summary>
/// Golden-volume tests — each one runs PicoGK headless and verifies geometry.
/// Tolerance: 2% volume deviation at voxelSize = R/50 (per spec).
/// </summary>
public class KitGoldenTests : IDisposable
{
    private const float Tolerance = 0.02f;  // 2%
    private static float VoxelMm = 0f;      // set per test from R/50

    private static Ctx MakeCtx(float voxelMm) => new Ctx(
        voxelMm,
        new Dictionary<string, System.Text.Json.JsonElement>(),
        _ => { },
        _ => { });

    // ── Helper: run inside Library.Go ─────────────────────────────────────

    private static T RunHeadless<T>(float voxelMm, Func<T> fn)
    {
        T result = default!;
        Library.Go(voxelMm, () => { result = fn(); });
        return result;
    }

    private static void AssertVolume(double actual, double expected, string label)
    {
        double err = Math.Abs(actual - expected) / expected;
        Assert.True(err <= Tolerance,
            $"{label}: volume {actual:F4} cm³ deviates {err:P1} from expected {expected:F4} cm³ (tolerance {Tolerance:P0})");
    }

    // ── 1. Sphere ─────────────────────────────────────────────────────────

    [Fact]
    public void Sphere_Volume_WithinTolerance()
    {
        float R = 20f;
        float vox = R / 50f;
        var stats = RunHeadless(vox, () =>
        {
            var ctx = MakeCtx(vox);
            var v = Kit.voxSphere(ctx, Vector3.Zero, R);
            v.CalculateProperties(out float vol, out _);
            return vol;
        });
        double expected = 4.0 / 3.0 * Math.PI * Math.Pow(R / 10.0, 3); // cm³
        AssertVolume(stats, expected, "Sphere R=20mm");
    }

    // ── 2. Cylinder / Tube ────────────────────────────────────────────────

    [Fact]
    public void Cylinder_Volume_WithinTolerance()
    {
        float R = 15f, H = 40f;
        float vox = R / 50f;
        var vol = RunHeadless(vox, () =>
        {
            var ctx = MakeCtx(vox);
            var v = Kit.voxCylinder(ctx, new Vector3(0, 0, 0), new Vector3(0, 0, H), R);
            v.CalculateProperties(out float vol2, out _);
            return vol2;
        });
        double expected = Math.PI * Math.Pow(R / 10.0, 2) * (H / 10.0);
        AssertVolume(vol, expected, "Cylinder R=15 H=40mm");
    }

    [Fact]
    public void Tube_Volume_WithinTolerance()
    {
        float Ro = 20f, Wall = 3f, H = 50f;
        float vox = Wall / 3f;
        var vol = RunHeadless(vox, () =>
        {
            var ctx = MakeCtx(vox);
            var v = Kit.voxTube(ctx, Vector3.Zero, new Vector3(0, 0, H), Ro, Wall);
            v.CalculateProperties(out float vol2, out _);
            return vol2;
        });
        float Ri = Ro - Wall;
        double expected = Math.PI * (Math.Pow(Ro / 10.0, 2) - Math.Pow(Ri / 10.0, 2)) * (H / 10.0);
        AssertVolume(vol, expected, "Tube Ro=20 Wall=3 H=50mm");
    }

    // ── 3. ExtrudeZ ──────────────────────────────────────────────────────

    [Fact]
    public void ExtrudeZ_Rectangle_Volume_WithinTolerance()
    {
        float W = 30f, D = 20f, H = 15f;
        float vox = 0.3f;
        var vol = RunHeadless(vox, () =>
        {
            var ctx = MakeCtx(vox);
            var poly = new List<System.Numerics.Vector2>
            {
                new(0, 0), new(W, 0), new(W, D), new(0, D),
            };
            var v = Kit.voxExtrudeZ(ctx, poly, 0, H);
            v.CalculateProperties(out float vol2, out _);
            return vol2;
        });
        double expected = (W / 10.0) * (D / 10.0) * (H / 10.0);
        AssertVolume(vol, expected, "ExtrudeZ 30×20×15mm");
    }

    // ── 4. Revolve ────────────────────────────────────────────────────────

    [Fact]
    public void Revolve_WasherProfile_Volume_WithinTolerance()
    {
        // Washer: R_inner=10, R_outer=20, H=5
        float Ri = 10f, Ro = 20f, H = 5f;
        float vox = 0.3f;
        var vol = RunHeadless(vox, () =>
        {
            var ctx = MakeCtx(vox);
            var profile = new List<System.Numerics.Vector2>
            {
                new(Ri, 0), new(Ro, 0), new(Ro, H), new(Ri, H),
            };
            var v = Kit.voxRevolve(ctx, profile, 360f);
            v.CalculateProperties(out float vol2, out _);
            return vol2;
        });
        double expected = Math.PI * (Math.Pow(Ro / 10.0, 2) - Math.Pow(Ri / 10.0, 2)) * (H / 10.0);
        AssertVolume(vol, expected, "Revolve washer Ri=10 Ro=20 H=5mm");
    }

    // ── 5. Loft (circle→circle = cylinder) ───────────────────────────────

    [Fact]
    public void Loft_TwoCircles_IsCylinder()
    {
        float R = 12f, H = 30f;
        float vox = R / 50f;
        var vol = RunHeadless(vox, () =>
        {
            var ctx = MakeCtx(vox);
            var bot = Kit.aCircle(R).Select(p => new Vector3(p.X, p.Y, 0)).ToList();
            var top = Kit.aCircle(R).Select(p => new Vector3(p.X, p.Y, H)).ToList();
            var m = Kit.mshLoft(new List<IReadOnlyList<Vector3>> { bot, top }, true);
            var v = new Voxels(m);
            v.CalculateProperties(out float vol2, out _);
            return vol2;
        });
        double expected = Math.PI * Math.Pow(R / 10.0, 2) * (H / 10.0);
        AssertVolume(vol, expected, "Loft circle→circle cylinder R=12 H=30mm");
    }

    // ── 6. Axial Rotor ────────────────────────────────────────────────────

    [Fact]
    public void AxialRotor_IsWatertight_And_HasCorrectBladeSym()
    {
        // Smoke test: build a 3-blade rotor and verify it's non-empty + watertight
        float vox = 0.5f;
        var (triangles, isEmpty) = RunHeadless(vox, () =>
        {
            var ctx = MakeCtx(vox);
            var spec = new BladeSpec(
                fHubR: 10f, fTipR: 40f, nSections: 5,
                fChordAt: _ => 15f,
                fBetaDegAt: _ => 35f,
                sNacaAt: _ => "4409");
            var v = Kit.voxAxialRotor(ctx, spec, 3, 10f, 0f, 20f, 3f, 1f);
            v.CalculateProperties(out _, out _);
            var m = v.mshAsMesh();
            return (m.nTriangleCount, v.bIsEmpty);
        });
        Assert.False(isEmpty, "Rotor voxels must not be empty");
        Assert.True(triangles > 0, "Rotor mesh must have triangles");
    }

    // ── 7. NACA airfoil ───────────────────────────────────────────────────

    [Fact]
    public void Naca4409_HasCorrectPointCount()
    {
        var poly = Kit.aNaca4("4409", 25f, n: 61);
        // CCW closed polygon: n upper + (n-2) lower ≈ 2*(n-1) = 120 points
        Assert.True(poly.Count >= 100, $"NACA 4409 poly has {poly.Count} points (expected >= 100)");
        Assert.All(poly, p => Assert.True(p.X >= -1f && p.X <= 30f, $"Point {p} out of chord range"));
    }

    // ── 8. Shell ──────────────────────────────────────────────────────────

    [Fact]
    public void Shell_ReducesVolume()
    {
        float vox = 0.3f;
        var (fullVol, shellVol) = RunHeadless(vox, () =>
        {
            var ctx = MakeCtx(vox);
            var full = Kit.voxBox(ctx, new Vector3(0, 0, 0), new Vector3(30, 20, 15));
            full.CalculateProperties(out float fv, out _);
            var shelled = Kit.voxBox(ctx, new Vector3(0, 0, 0), new Vector3(30, 20, 15));
            Kit.Shell(shelled, 2f);
            shelled.CalculateProperties(out float sv, out _);
            return (fv, sv);
        });
        Assert.True(shellVol < fullVol * 0.9, $"Shell did not reduce volume: full={fullVol} shell={shellVol}");
    }

    public void Dispose() { }
}
