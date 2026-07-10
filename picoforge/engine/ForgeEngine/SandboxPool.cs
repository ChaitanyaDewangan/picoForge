// ForgeEngine/SandboxPool.cs — Sandbox child lifecycle management
// SYS_DESIGN §4.1, §4.3: prewarm 1 spare child, spawn/kill/monitor (RSS 250ms poll)

using System.Diagnostics;

namespace ForgeEngine;

public sealed class RunLimits
{
    public int TimeoutS { get; init; } = 120;
    public long MaxRssMiB { get; init; } = 8192;
    public long MaxCells { get; init; } = 1_500_000_000;
}

public sealed class SandboxResult
{
    public bool Ok { get; init; }
    public string? ErrorCode { get; init; }
    public string? ErrorDetail { get; init; }
    public string? Log { get; init; }
    public int ExitCode { get; init; }
}

public sealed class SandboxPool : IDisposable
{
    private readonly string _sandboxBin;
    private Process? _spare;         // prewarmed spare (no job loaded)
    private readonly Lock _lock = new();
    private bool _disposed;

    public SandboxPool(string sandboxBin)
    {
        _sandboxBin = sandboxBin;
        // Prewarm one spare on construction
        _ = Task.Run(PrewarmSpare);
    }

    /// <summary>
    /// Execute a job file in a sandbox child.
    /// Returns when the child exits or is killed by a guard.
    /// </summary>
    public async Task<SandboxResult> RunAsync(
        string jobPath,
        RunLimits limits,
        Action<string> onLog,
        CancellationToken cancel)
    {
        Process child;
        lock (_lock)
        {
            // Hand the prewarmed spare this job (write job path to its stdin)
            if (_spare != null && !_spare.HasExited)
            {
                child = _spare;
                _spare = null;
            }
            else
            {
                child = SpawnChild();
            }
        }

        // Fork a replacement spare immediately
        _ = Task.Run(PrewarmSpare);

        var logLines = new System.Text.StringBuilder();
        var lineCount = 0;
        const int MaxLogLines = 5000;

        child.OutputDataReceived += (_, e) =>
        {
            if (e.Data is null) return;
            lineCount++;
            if (lineCount <= MaxLogLines)
            {
                logLines.AppendLine(e.Data);
                onLog(e.Data);
            }
            else if (lineCount == MaxLogLines + 1)
            {
                var truncMsg = "[log truncated at 5000 lines]";
                logLines.AppendLine(truncMsg);
                onLog(truncMsg);
            }
        };

        try
        {
            // Send job path to child via stdin
            await child.StandardInput.WriteLineAsync(jobPath);
            await child.StandardInput.FlushAsync(cancel);
            child.StandardInput.Close();
            child.BeginOutputReadLine();

            // RSS poll + timeout guard
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancel);
            cts.CancelAfter(TimeSpan.FromSeconds(limits.TimeoutS));

            var rssTask = Task.Run(async () =>
            {
                while (!child.HasExited)
                {
                    try
                    {
                        child.Refresh();
                        var rssMiB = child.WorkingSet64 / 1_048_576L;
                        if (rssMiB > limits.MaxRssMiB)
                        {
                            onLog($"[OOM guard] RSS {rssMiB} MiB exceeds limit {limits.MaxRssMiB} MiB — killing");
                            child.Kill(entireProcessTree: true);
                            return "OOM";
                        }
                    }
                    catch { /* child may already be gone */ }
                    await Task.Delay(250, cts.Token).ConfigureAwait(false);
                }
                return (string?)null;
            }, cts.Token);

            try
            {
                await child.WaitForExitAsync(cts.Token);
            }
            catch (OperationCanceledException)
            {
                // Timeout
                try { child.Kill(entireProcessTree: true); } catch { }
                return new SandboxResult
                {
                    Ok = false,
                    ErrorCode = "TIMEOUT",
                    ErrorDetail = $"Exceeded {limits.TimeoutS}s wall-clock limit",
                    Log = logLines.ToString(),
                    ExitCode = -1,
                };
            }

            var oomReason = await rssTask;
            if (oomReason is not null)
            {
                return new SandboxResult
                {
                    Ok = false,
                    ErrorCode = "OOM",
                    ErrorDetail = $"RSS exceeded {limits.MaxRssMiB} MiB",
                    Log = logLines.ToString(),
                    ExitCode = child.ExitCode,
                };
            }

            if (child.ExitCode != 0)
            {
                return new SandboxResult
                {
                    Ok = false,
                    ErrorCode = "SANDBOX_CRASH",
                    ErrorDetail = $"Child exited with code {child.ExitCode}",
                    Log = logLines.ToString(),
                    ExitCode = child.ExitCode,
                };
            }

            return new SandboxResult { Ok = true, Log = logLines.ToString(), ExitCode = 0 };
        }
        finally
        {
            if (!child.HasExited) { try { child.Kill(entireProcessTree: true); } catch { } }
            child.Dispose();
        }
    }

    public void CancelCurrentChild()
    {
        // Used by engine.cancel — kills current spare if it's executing
        // In production, we track the active child separately; stub for M1
    }

    private Process SpawnChild()
    {
        var psi = new ProcessStartInfo(_sandboxBin)
        {
            UseShellExecute = false,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = false,
            CreateNoWindow = true,
        };
        var p = Process.Start(psi) ?? throw new InvalidOperationException($"Failed to start sandbox: {_sandboxBin}");
        return p;
    }

    private void PrewarmSpare()
    {
        if (_disposed) return;
        try
        {
            var spare = SpawnChild();
            lock (_lock)
            {
                if (_disposed) { try { spare.Kill(); } catch { } spare.Dispose(); return; }
                if (_spare != null) { try { _spare.Kill(); } catch { } _spare.Dispose(); }
                _spare = spare;
            }
        }
        catch { /* prewarm is best-effort */ }
    }

    public void Dispose()
    {
        _disposed = true;
        lock (_lock)
        {
            if (_spare != null)
            {
                try { _spare.Kill(); } catch { }
                _spare.Dispose();
                _spare = null;
            }
        }
    }
}
