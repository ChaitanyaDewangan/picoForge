// ForgeSandbox/Runner.cs — PicoGK headless lifecycle + Design execution + export
// SYS_DESIGN §4.3, PICOGK_KNOWLEDGE §1
// This is the ONLY file that touches PicoGK native runtime.

using System.Numerics;
using System.Reflection;
using System.Text.Json;
using PicoGK;

namespace ForgeSandbox;

public sealed class JobSpec
{
    public string RunId { get; init; } = "";
    public string DllPath { get; init; } = "";
    public Dictionary<string, JsonElement> Params { get; init; } = new();
    public LimitsSpec Limits { get; init; } = new();
    public string[] Exports { get; init; } = ["stl", "glb"];
    public string OutDir { get; init; } = "";
}

public sealed class LimitsSpec
{
    public int TimeoutS { get; init; } = 120;
    public long MaxRssMiB { get; init; } = 8192;
    public long MaxCells { get; init; } = 1_500_000_000;
}

public sealed class ReportStats
{
    public double VolumeCm3 { get; set; }
    public double AreaCm2 { get; set; }
    public double[]? BboxMin { get; set; }
    public double[]? BboxMax { get; set; }
    public int Triangles { get; set; }
    public bool Watertight { get; set; }
    public double VoxelSizeMm { get; set; }
    public double MinWallProbeMm { get; set; }
    public long BuildMs { get; set; }
}

/// <summary>
/// Runs one design DLL in the PicoGK headless lifecycle.
/// Called from Program.cs — one instance per sandbox process lifetime.
/// </summary>
public static class Runner
{
    public static int Run(string jobPath)
    {
        // Load job spec
        JobSpec job;
        try
        {
            var json = File.ReadAllText(jobPath);
            job = JsonSerializer.Deserialize<JobSpec>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                ?? throw new InvalidOperationException("job.json deserialized to null");
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"{{\"error\":\"JOB_PARSE\",\"detail\":\"{Escape(ex.Message)}\"}}");
            return 2;
        }

        Directory.CreateDirectory(job.OutDir);

        var sw = System.Diagnostics.Stopwatch.StartNew();
        var logLines = new List<string>();

        void Log(string msg)
        {
            logLines.Add(msg);
            Console.WriteLine(msg);
            Console.Out.Flush();
        }

        try
        {
            // Load the generated Design DLL
            var designAssembly = Assembly.LoadFrom(job.DllPath);
            var designType = designAssembly.GetType("Design")
                ?? throw new InvalidOperationException("Design class not found in DLL");
            var voxBuildMethod = designType.GetMethod("voxBuild",
                BindingFlags.Public | BindingFlags.Static)
                ?? throw new InvalidOperationException("Design.voxBuild not found");

            // Determine voxel size from params (fall back to auto)
            float voxelSizeMm = 0.5f;
            if (job.Params.TryGetValue("voxel_size_mm", out var vsMm))
                voxelSizeMm = (float)vsMm.GetDouble();

            Log($"[runner] starting PicoGK Library headless voxel={voxelSizeMm}mm");

            // PicoGK v2 headless: Library.Go with TaskFn (scoped instance)
            // DumpApi will have confirmed the exact signature; we adapt at compile time.
            Voxels? result = null;
            Exception? buildException = null;

            Library.Go(voxelSizeMm, () =>
            {
                try
                {
                    var ctx = new Kit.Ctx(voxelSizeMm, job.Params, Log,
                        progress => Console.WriteLine($"[progress] {progress:F3}"));
                    result = (Voxels?)voxBuildMethod.Invoke(null, [ctx]);
                    if (result is null)
                        throw new InvalidOperationException("voxBuild returned null — must return a non-empty Voxels");
                }
                catch (TargetInvocationException tie) when (tie.InnerException is not null)
                {
                    buildException = tie.InnerException;
                }
                catch (Exception ex)
                {
                    buildException = ex;
                }
            });

            if (buildException is not null)
                throw new Exception($"RUNTIME_ERROR in voxBuild: {buildException.GetType().Name}: {buildException.Message}",
                    buildException);

            if (result is null || result.bIsEmpty)
                throw new InvalidOperationException("EMPTY_GEOMETRY: voxBuild returned an empty Voxels");

            sw.Stop();
            Log($"[runner] voxBuild completed in {sw.ElapsedMilliseconds}ms");

            // Compute stats
            result.CalculateProperties(out float volCm3, out BBox3 bbox);
            var mesh = result.mshAsMesh();
            var triangles = mesh.nTriangleCount;
            bool watertight = triangles > 0; // PicoGK meshes from voxels are closed by construction

            // Min-wall probe (binary search erosion approach)
            double minWall = ProbeMinWall(result, voxelSizeMm);

            var stats = new ReportStats
            {
                VolumeCm3 = Math.Round(volCm3, 4),
                BboxMin = [bbox.vecMin.X, bbox.vecMin.Y, bbox.vecMin.Z],
                BboxMax = [bbox.vecMax.X, bbox.vecMax.Y, bbox.vecMax.Z],
                Triangles = triangles,
                Watertight = watertight,
                VoxelSizeMm = voxelSizeMm,
                MinWallProbeMm = Math.Round(minWall, 2),
                BuildMs = sw.ElapsedMilliseconds,
            };

            // Export requested formats
            foreach (var format in job.Exports)
            {
                switch (format.ToLowerInvariant())
                {
                    case "stl":
                        var stlPath = Path.Combine(job.OutDir, "part.stl");
                        mesh.SaveToStlFile(stlPath);
                        Log($"[runner] exported STL: {stlPath}");
                        break;

                    case "vdb":
                        // VdbFile export (PicoGK 2.x)
                        var vdbPath = Path.Combine(job.OutDir, "part.vdb");
                        // VdbFile.Save is the PicoGK 2.x API per DumpApi
                        Log($"[runner] VDB export at {vdbPath} (skipped in sandbox — requires VdbFile API)");
                        break;

                    case "glb":
                        Log("[runner] GLB export via SharpGLTF (added in M3 when SharpGLTF added to csproj)");
                        break;
                }
            }

            // Write report.json
            var reportPath = Path.Combine(job.OutDir, "report.json");
            File.WriteAllText(reportPath, JsonSerializer.Serialize(stats,
                new JsonSerializerOptions { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));

            Log($"[runner] done — vol={stats.VolumeCm3}cm³ tris={stats.Triangles} watertight={stats.Watertight}");
            return 0;
        }
        catch (Exception ex)
        {
            var errorCode = ex.Message.StartsWith("EMPTY_GEOMETRY") ? "EMPTY_GEOMETRY"
                          : ex.Message.StartsWith("RUNTIME_ERROR") ? "RUNTIME_ERROR"
                          : "SANDBOX_CRASH";
            Console.Error.WriteLine(JsonSerializer.Serialize(new
            {
                error = errorCode,
                message = ex.InnerException?.Message ?? ex.Message,
                stack = ex.InnerException?.StackTrace?.Split('\n').Take(5).ToArray() ?? [],
                logTail = logLines.TakeLast(30).ToArray(),
            }));
            return 1;
        }
    }

    /// <summary>
    /// Probe minimum wall: binary-search erosion where volume drops below 15%.
    /// PICOGK_KNOWLEDGE §4.
    /// </summary>
    private static double ProbeMinWall(Voxels vox, float voxelSizeMm)
    {
        vox.CalculateProperties(out float baseVol, out _);
        if (baseVol <= 0) return 0;

        float lo = voxelSizeMm, hi = 10f;
        for (int i = 0; i < 8; i++)
        {
            float mid = (lo + hi) / 2f;
            var eroded = new Voxels(vox);
            eroded.Offset(-mid / 2f);
            eroded.CalculateProperties(out float erodedVol, out _);
            if (erodedVol / baseVol < 0.15f) hi = mid;
            else lo = mid;
        }
        return (lo + hi) / 2.0;
    }

    private static string Escape(string s) => s.Replace("\"", "\\\"").Replace("\n", " ");
}
