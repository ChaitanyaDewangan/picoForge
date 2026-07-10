// ForgeEngine/Compiler.cs — Roslyn in-memory compilation with LRU cache
// SYS_DESIGN §4.1, LLM_HARNESS §4

using System.Collections.Concurrent;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Emit;

namespace ForgeEngine;

public sealed record Diagnostic(string Id, string Severity, int Line, int Col, string Message);

public sealed record CompileResult(
    bool Ok,
    string CodeId,
    bool DllCached,
    IReadOnlyList<Diagnostic> Diagnostics,
    byte[]? DllBytes = null
);

public sealed class Compiler
{
    // LRU cache: codeHash → dll bytes (max 32 entries)
    private readonly ConcurrentDictionary<string, byte[]> _cache = new();
    private readonly Queue<string> _cacheOrder = new();
    private const int MaxCacheEntries = 32;
    private readonly Lock _cacheLock = new();

    // Whitelist of allowed using directives (LLM_HARNESS §4 code contract)
    private static readonly HashSet<string> AllowedUsings = new(StringComparer.Ordinal)
    {
        "System",
        "System.Numerics",
        "System.Collections.Generic",
        "System.Linq",
        "PicoGK",
        "PicoForge.Kit",
    };

    // Namespaces/types that are banned (SYS_DESIGN §10)
    private static readonly string[] BannedNamespacePrefixes =
    [
        "System.IO",
        "System.Net",
        "System.Reflection.Emit",
        "System.Diagnostics",
        "System.Threading",
        "System.Environment",
        "System.AppDomain",
    ];

    private static readonly string[] BannedMemberPatterns =
    [
        "DllImport",
        "Environment.Exit",
        "GC.Collect",
        "GC.SuppressFinalize",
        "AppDomain",
    ];

    private readonly IReadOnlyList<MetadataReference> _references;

    public Compiler()
    {
        // Collect all loaded assemblies as references
        _references = AppDomain.CurrentDomain.GetAssemblies()
            .Where(a => !a.IsDynamic && !string.IsNullOrEmpty(a.Location))
            .Select(a => (MetadataReference)MetadataReference.CreateFromFile(a.Location))
            .ToArray();
    }

    public CompileResult Compile(string code, string? requestedCodeId = null)
    {
        var hash = ComputeHash(code);
        var codeId = requestedCodeId ?? hash;

        // Cache hit
        lock (_cacheLock)
        {
            if (_cache.TryGetValue(hash, out var cached))
                return new CompileResult(true, codeId, true, [], cached);
        }

        // Pre-compile structural check
        var contractViolations = CheckContract(code);
        if (contractViolations.Count > 0)
            return new CompileResult(false, codeId, false, contractViolations);

        // Parse
        var syntaxTree = CSharpSyntaxTree.ParseText(code, new CSharpParseOptions(
            languageVersion: LanguageVersion.CSharp12));

        // Compile
        var compilation = CSharpCompilation.Create(
            assemblyName: $"Design_{hash[..8]}",
            syntaxTrees: [syntaxTree],
            references: _references,
            options: new CSharpCompilationOptions(
                OutputKind.DynamicallyLinkedLibrary,
                optimizationLevel: OptimizationLevel.Release,
                allowUnsafe: false,
                nullableContextOptions: NullableContextOptions.Enable
            )
        );

        using var ms = new MemoryStream();
        var emitResult = compilation.Emit(ms);

        var diagnostics = emitResult.Diagnostics
            .Where(d => d.Severity >= Microsoft.CodeAnalysis.DiagnosticSeverity.Warning)
            .Take(12)
            .Select(d =>
            {
                var loc = d.Location.GetLineSpan();
                return new Diagnostic(
                    d.Id,
                    d.Severity.ToString(),
                    loc.StartLinePosition.Line + 1,
                    loc.StartLinePosition.Character + 1,
                    d.GetMessage()
                );
            })
            .ToArray();

        if (!emitResult.Success)
            return new CompileResult(false, codeId, false, diagnostics);

        var dllBytes = ms.ToArray();

        // Cache
        lock (_cacheLock)
        {
            if (_cacheOrder.Count >= MaxCacheEntries)
                _cache.TryRemove(_cacheOrder.Dequeue(), out _);
            _cache[hash] = dllBytes;
            _cacheOrder.Enqueue(hash);
        }

        return new CompileResult(true, codeId, false, diagnostics, dllBytes);
    }

    public bool TryGetCached(string codeHash, out byte[]? dll)
        => _cache.TryGetValue(codeHash, out dll);

    private static string ComputeHash(string code)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(code));
        return Convert.ToHexStringLower(bytes);
    }

    private static List<Diagnostic> CheckContract(string code)
    {
        var errors = new List<Diagnostic>();

        // Must contain exactly one public static class Design
        if (!System.Text.RegularExpressions.Regex.IsMatch(code,
            @"public\s+static\s+class\s+Design\b"))
        {
            errors.Add(new Diagnostic("CONTRACT001", "Error", 0, 0,
                "CONTRACT_VIOLATION: Missing 'public static class Design'"));
        }

        // Must contain voxBuild method
        if (!System.Text.RegularExpressions.Regex.IsMatch(code,
            @"public\s+static\s+.*Voxels\s+voxBuild\s*\("))
        {
            errors.Add(new Diagnostic("CONTRACT002", "Error", 0, 0,
                "CONTRACT_VIOLATION: Missing 'public static Voxels voxBuild(Ctx ctx)' in Design"));
        }

        // Check using directives
        var usingMatches = System.Text.RegularExpressions.Regex.Matches(code,
            @"^\s*using\s+([\w\.]+)\s*;", System.Text.RegularExpressions.RegexOptions.Multiline);
        foreach (System.Text.RegularExpressions.Match m in usingMatches)
        {
            var ns = m.Groups[1].Value;
            if (!AllowedUsings.Contains(ns))
            {
                errors.Add(new Diagnostic("CONTRACT003", "Error", 0, 0,
                    $"CONTRACT_VIOLATION: Disallowed using '{ns}'. Allowed: {string.Join(", ", AllowedUsings)}"));
            }
        }

        // File length check
        var lineCount = code.Split('\n').Length;
        if (lineCount > 1200)
        {
            errors.Add(new Diagnostic("CONTRACT004", "Error", 0, 0,
                $"CONTRACT_VIOLATION: File exceeds 1200 lines ({lineCount} lines)"));
        }

        return errors;
    }
}
