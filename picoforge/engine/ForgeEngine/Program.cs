// ForgeEngine/Program.cs — Engine host entry point (full M1 implementation)
// stdin ndjson JSON-RPC loop; supervises sandbox children.
// SYS_DESIGN §4.1–4.3

using System.Text.Json;
using System.Text.Json.Nodes;
using ForgeEngine;

var version = "1.0.0-m1";
var symbolTablePath = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "picogk_api.json");
if (!File.Exists(symbolTablePath))
    symbolTablePath = Path.Combine(Directory.GetCurrentDirectory(), "picogk_api.json");

var symbolTable = SymbolTable.Load(symbolTablePath);
var compiler = new Compiler();
var sandboxBin = Environment.GetEnvironmentVariable("FORGE_SANDBOX_BIN")
    ?? Path.Combine(AppContext.BaseDirectory, "..", "ForgeSandbox", "net9.0", "forge-sandbox");

SandboxPool? pool = null;
try { pool = new SandboxPool(sandboxBin); } catch { /* sandbox may not be built yet */ }

Console.Error.WriteLine($"[engine] forge-engine {version} ready (symbolTableHash={symbolTable.Hash})");

await foreach (var line in ReadLinesAsync(Console.In))
{
    if (string.IsNullOrWhiteSpace(line)) continue;

    var req = RpcRequest.TryParse(line);
    if (req is null) { RpcWriter.WriteError(null, "PARSE_ERROR", "Invalid JSON-RPC frame"); continue; }

    switch (req.Method)
    {
        case "engine.hello":
            RpcWriter.WriteResult(req.Id, new
            {
                version,
                picogkVersion = "resolved-via-sandbox",
                dotnet = Environment.Version.ToString(),
                symbolTableHash = symbolTable.Hash,
            });
            break;

        case "engine.ping":
            RpcWriter.WriteResult(req.Id, new
            {
                ok = true,
                rssMiB = GC.GetTotalMemory(false) / 1_048_576.0,
                children = 0,  // pool tracking added in M3
            });
            break;

        case "engine.compile":
        {
            var code = req.Params?["code"]?.GetValue<string>() ?? "";
            var codeId = req.Params?["codeId"]?.GetValue<string>();

            // Run banned-symbol analysis first
            var bannedDiags = BannedSymbolAnalyzer.Analyze(code, symbolTable);
            if (bannedDiags.Count > 0)
            {
                RpcWriter.WriteResult(req.Id, new
                {
                    ok = false,
                    diagnostics = bannedDiags.Select(d => new
                    { id = d.Id, severity = d.Severity, line = d.Line, col = d.Col, message = d.Message }),
                    dllCached = false,
                });
                break;
            }

            var result = compiler.Compile(code, codeId);
            RpcWriter.WriteResult(req.Id, new
            {
                ok = result.Ok,
                diagnostics = result.Diagnostics.Select(d => new
                { id = d.Id, severity = d.Severity, line = d.Line, col = d.Col, message = d.Message }),
                dllCached = result.DllCached,
            });
            break;
        }

        case "engine.run":
        {
            if (pool is null) { RpcWriter.WriteError(req.Id, "SANDBOX_UNAVAILABLE", "Sandbox pool not initialized"); break; }

            var code = req.Params?["code"]?.GetValue<string>();
            var codeId = req.Params?["codeId"]?.GetValue<string>();
            var outDir = req.Params?["outDir"]?.GetValue<string>() ?? Path.GetTempPath();
            var runId = req.Params?["runId"]?.GetValue<string>() ?? Guid.NewGuid().ToString("N");

            // Limits from params or defaults
            var limitsNode = req.Params?["limits"];
            var limits = new RunLimits
            {
                TimeoutS  = limitsNode?["timeoutS"]?.GetValue<int>() ?? 120,
                MaxRssMiB = limitsNode?["maxRssMiB"]?.GetValue<long>() ?? 8192,
                MaxCells  = limitsNode?["maxCells"]?.GetValue<long>() ?? 1_500_000_000,
            };

            // Compile if code provided directly
            CompileResult? compileResult = null;
            if (code is not null)
            {
                compileResult = compiler.Compile(code, codeId);
                if (!compileResult.Ok)
                {
                    RpcWriter.WriteResult(req.Id, new
                    {
                        ok = false,
                        error = new { code = "COMPILE_ERROR",
                            diagnostics = compileResult.Diagnostics.Select(d => new
                            { id = d.Id, severity = d.Severity, line = d.Line, col = d.Col, message = d.Message }) },
                    });
                    break;
                }
            }

            // Build job file
            Directory.CreateDirectory(outDir);
            var jobPath = Path.Combine(outDir, "job.json");
            var jobParams = req.Params?["params"]?.ToJsonString() ?? "{}";
            var exports = req.Params?["exports"]?.AsArray()?.Select(x => x?.GetValue<string>() ?? "").ToArray()
                          ?? ["stl", "glb"];

            var dllPath = compileResult?.DllBytes is not null
                ? WriteDll(outDir, compileResult.DllBytes)
                : Path.Combine(outDir, "design.dll");

            File.WriteAllText(jobPath, JsonSerializer.Serialize(new
            {
                runId,
                dllPath,
                @params = JsonNode.Parse(jobParams),
                limits = new { limits.TimeoutS, limits.MaxRssMiB, limits.MaxCells },
                exports,
                outDir,
            }));

            // Run in sandbox
            var sandboxResult = await pool.RunAsync(
                jobPath, limits,
                onLog: log => RpcWriter.WriteNotification("run.log", new { runId, line = log }),
                cancel: CancellationToken.None);

            if (!sandboxResult.Ok)
            {
                RpcWriter.WriteResult(req.Id, new
                {
                    ok = false,
                    error = new { code = sandboxResult.ErrorCode, detail = sandboxResult.ErrorDetail },
                    log = sandboxResult.Log?.Split('\n').TakeLast(30).ToArray(),
                });
                break;
            }

            // Read report.json if present
            var reportPath = Path.Combine(outDir, "report.json");
            object? stats = null;
            if (File.Exists(reportPath))
                stats = JsonNode.Parse(File.ReadAllText(reportPath));

            RpcWriter.WriteResult(req.Id, new
            {
                ok = true,
                stats,
                files = new
                {
                    stl = File.Exists(Path.Combine(outDir, "part.stl")) ? Path.Combine(outDir, "part.stl") : (string?)null,
                    glb = File.Exists(Path.Combine(outDir, "part.glb")) ? Path.Combine(outDir, "part.glb") : (string?)null,
                    vdb = File.Exists(Path.Combine(outDir, "part.vdb")) ? Path.Combine(outDir, "part.vdb") : (string?)null,
                    report = reportPath,
                },
                log = sandboxResult.Log?.Split('\n').TakeLast(15).ToArray(),
            });
            break;
        }

        case "engine.cancel":
            pool?.CancelCurrentChild();
            RpcWriter.WriteResult(req.Id, new { ok = true });
            break;

        case "engine.inspect":
            // Inspection ops delegated to sandbox in M3; stub for now
            RpcWriter.WriteResult(req.Id, new { ok = true, note = "inspect implemented in M3" });
            break;

        case "engine.convert":
            RpcWriter.WriteResult(req.Id, new { ok = true, note = "convert implemented in M3" });
            break;

        default:
            RpcWriter.WriteError(req.Id, "METHOD_NOT_FOUND", $"Unknown method '{req.Method}'");
            break;
    }
}

static string WriteDll(string outDir, byte[] dllBytes)
{
    var path = Path.Combine(outDir, "design.dll");
    File.WriteAllBytes(path, dllBytes);
    return path;
}

static async IAsyncEnumerable<string> ReadLinesAsync(TextReader reader)
{
    string? line;
    while ((line = await reader.ReadLineAsync()) != null)
        yield return line;
}
