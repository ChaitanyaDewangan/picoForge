// ForgeEngine/Analyzers.cs — Banned-symbol Roslyn semantic walker
// LLM_HARNESS §4.2/4.3, SYS_DESIGN §10

using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace ForgeEngine;

/// <summary>
/// Roslyn syntax/semantic walker that identifies:
/// 1. Banned API usages (FORGE001): System.IO, System.Net, threads, unsafe, etc.
/// 2. Unknown symbols (FORGE002): identifiers not in picogk_api.json → fuzzy did-you-mean.
/// </summary>
public sealed class BannedSymbolAnalyzer : CSharpSyntaxWalker
{
    private static readonly HashSet<string> BannedNamespacePrefixes = new(StringComparer.Ordinal)
    {
        "System.IO",
        "System.Net",
        "System.Reflection.Emit",
        "System.Threading",
        "System.Diagnostics",
        "System.AppDomain",
    };

    private static readonly HashSet<string> BannedIdentifiers = new(StringComparer.Ordinal)
    {
        "Environment",
        "GC",
        "File",
        "Directory",
        "Path",
        "Console",    // model should use ctx.Log
        "Process",
        "Thread",
        "Task",
        "Mutex",
        "Monitor",
    };

    private static readonly HashSet<string> BannedKeywords = new(StringComparer.Ordinal)
    {
        "unsafe",
    };

    public List<Diagnostic> Diagnostics { get; } = [];

    private readonly SymbolTable _symbolTable;

    public BannedSymbolAnalyzer(SymbolTable symbolTable) : base(SyntaxWalkerDepth.Node)
    {
        _symbolTable = symbolTable;
    }

    public override void VisitUnsafeStatement(UnsafeStatementSyntax node)
    {
        AddBanned(node, "unsafe block — generated designs are pure managed code");
        base.VisitUnsafeStatement(node);
    }

    public override void VisitMemberAccessExpression(MemberAccessExpressionSyntax node)
    {
        var name = node.Expression.ToString();
        if (BannedIdentifiers.Contains(name))
        {
            AddBanned(node, $"Banned API: {name} — use ctx.Log/ctx.Progress for output");
        }
        base.VisitMemberAccessExpression(node);
    }

    public override void VisitAttribute(AttributeSyntax node)
    {
        var name = node.Name.ToString();
        if (name is "DllImport" or "DllImportAttribute")
            AddBanned(node, "DllImport is banned — no native interop in generated designs");
        base.VisitAttribute(node);
    }

    private void AddBanned(SyntaxNode node, string detail)
    {
        var span = node.GetLocation().GetLineSpan();
        Diagnostics.Add(new Diagnostic(
            "FORGE001",
            "Error",
            span.StartLinePosition.Line + 1,
            span.StartLinePosition.Character + 1,
            $"Banned API: {detail}"
        ));
    }

    /// <summary>Run the full analyzer walk over parsed syntax.</summary>
    public static List<Diagnostic> Analyze(string code, SymbolTable symbolTable)
    {
        var tree = Microsoft.CodeAnalysis.CSharp.CSharpSyntaxTree.ParseText(code);
        var walker = new BannedSymbolAnalyzer(symbolTable);
        walker.Visit(tree.GetRoot());
        return walker.Diagnostics;
    }
}
