// ForgeSandbox/Kit/Ctx.cs — The context object generated designs receive
// LLM_HARNESS §4.4: Ctx definition

using System.Text.Json;

namespace PicoForge.Kit;

/// <summary>
/// The only object generated code receives.
/// Carries voxel size, parameters from design brief, material, logger, progress.
/// LLM_HARNESS §4.4
/// </summary>
public sealed class Ctx
{
    public float fVoxelMM { get; }
    public Params oParams { get; }
    public Material oMat { get; }
    public Rng Rng { get; }
    public float fTimeLimitS { get; }

    private readonly Action<string> _log;
    private readonly Action<float> _progress;

    public Ctx(
        float voxelMm,
        Dictionary<string, JsonElement> rawParams,
        Action<string> log,
        Action<float> progress,
        Material? material = null,
        float timeLimitS = 120f,
        string? runId = null)
    {
        fVoxelMM = voxelMm;
        oParams = new Params(rawParams);
        oMat = material ?? Material.Petg;
        Rng = new Rng(runId ?? "default");
        fTimeLimitS = timeLimitS;
        _log = log;
        _progress = progress;
    }

    public void Log(string s) => _log(s);
    public void Progress(float f01) => _progress(Math.Clamp(f01, 0f, 1f));
}

/// <summary>Typed accessors over brief parameters.</summary>
public sealed class Params
{
    private readonly Dictionary<string, JsonElement> _raw;

    public Params(Dictionary<string, JsonElement> raw) => _raw = raw;

    public float f(string name)
    {
        if (_raw.TryGetValue(name, out var v)) return (float)v.GetDouble();
        throw new KeyNotFoundException(
            $"Parameter '{name}' not found. Available: {string.Join(", ", _raw.Keys)}");
    }

    public int n(string name)
    {
        if (_raw.TryGetValue(name, out var v)) return v.GetInt32();
        throw new KeyNotFoundException(
            $"Parameter '{name}' not found. Available: {string.Join(", ", _raw.Keys)}");
    }

    public System.Numerics.Vector3 vec(string name)
    {
        if (_raw.TryGetValue(name, out var v))
        {
            var arr = v.EnumerateArray().Select(e => (float)e.GetDouble()).ToArray();
            if (arr.Length >= 3) return new System.Numerics.Vector3(arr[0], arr[1], arr[2]);
        }
        throw new KeyNotFoundException(
            $"Parameter '{name}' not found or not a 3-element array. Available: {string.Join(", ", _raw.Keys)}");
    }

    public bool Has(string name) => _raw.ContainsKey(name);
}

/// <summary>Material presets — DATA_SCHEMA materials table.</summary>
public sealed record Material(
    string Name,
    float DensityGcm3,
    float YieldMPa,
    float EGPa,
    float MinWallMM,
    float MaxTempC)
{
    public static readonly Material Pla   = new("PLA",        1.24f, 45f,  3.5f, 1.0f,  55f);
    public static readonly Material Petg  = new("PETG",       1.27f, 50f,  2.1f, 1.0f,  75f);
    public static readonly Material Abs   = new("ABS",        1.05f, 40f,  2.0f, 1.2f,  95f);
    public static readonly Material Pa12  = new("PA12",       1.01f, 48f,  1.7f, 0.8f, 120f);
    public static readonly Material Resin = new("Resin",      1.15f, 55f,  2.6f, 0.6f,  60f);
    public static readonly Material Al6061= new("Al6061-T6",  2.70f, 276f, 68.9f,0.8f, 200f);
    public static readonly Material Ss316L= new("SS316L",     8.00f, 205f,193f,  0.5f, 400f);

    public static Material FromName(string name) => name.ToUpperInvariant() switch
    {
        "PLA"       => Pla,
        "PETG"      => Petg,
        "ABS"       => Abs,
        "PA12"      => Pa12,
        "RESIN"     => Resin,
        "AL6061-T6" => Al6061,
        "SS316L"    => Ss316L,
        _ => throw new ArgumentException($"Unknown material '{name}'. Valid: PLA, PETG, ABS, PA12, Resin, Al6061-T6, SS316L"),
    };
}

/// <summary>Seeded deterministic RNG — no DateTime.Now, no new Random() in generated code.</summary>
public sealed class Rng
{
    private readonly Random _rng;

    public Rng(string seed)
    {
        _rng = new Random(seed.GetHashCode());
    }

    public float NextFloat() => (float)_rng.NextDouble();
    public float NextFloat(float min, float max) => min + (max - min) * NextFloat();
    public int NextInt(int min, int max) => _rng.Next(min, max);
}
