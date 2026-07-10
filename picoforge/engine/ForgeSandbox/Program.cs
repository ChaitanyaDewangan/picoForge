// ForgeSandbox/Program.cs — Sandbox child entry point (full M1)
// Receives job path via stdin line, runs Runner, exits.
// SYS_DESIGN §4.3: "child: load DLL → reflect Design.voxBuild → invoke → receive Voxels"

using ForgeSandbox;

// Read job path from first stdin line (host writes it after handing spare to a job)
var jobPath = (string?)null;

// Support both --job <path> arg and stdin line
for (int i = 0; i < args.Length - 1; i++)
    if (args[i] == "--job") { jobPath = args[i + 1]; break; }

if (jobPath is null)
{
    // Read from stdin (prewarmed spare receives job via stdin)
    jobPath = Console.ReadLine()?.Trim();
}

if (string.IsNullOrEmpty(jobPath))
{
    Console.Error.WriteLine("{\"error\":\"NO_JOB\",\"detail\":\"No job path provided via --job or stdin\"}");
    return 1;
}

if (!File.Exists(jobPath))
{
    Console.Error.WriteLine($"{{\"error\":\"JOB_NOT_FOUND\",\"detail\":\"Job file not found: {jobPath}\"}}");
    return 1;
}

return Runner.Run(jobPath);
