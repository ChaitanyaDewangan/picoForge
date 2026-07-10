// ForgeEngine/SymbolTable.cs — Loads picogk_api.json and provides fuzzy matching
// LLM_HARNESS §4.3 — unknown symbols get "did you mean?" suggestions

using System.Text.Json;

namespace ForgeEngine;

public sealed record ApiSymbol(string TypeName, string MemberName, string Kind, string Sig);

public sealed class SymbolTable
{
    private readonly IReadOnlyList<ApiSymbol> _symbols;
    private readonly string _hash;

    public string Hash => _hash;

    private SymbolTable(IReadOnlyList<ApiSymbol> symbols, string hash)
    {
        _symbols = symbols;
        _hash = hash;
    }

    public static SymbolTable Load(string jsonPath)
    {
        if (!File.Exists(jsonPath))
            return new SymbolTable([], "empty");

        var json = File.ReadAllText(jsonPath);
        var hash = Convert.ToHexStringLower(
            System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(json)));

        var doc = JsonDocument.Parse(json);
        var symbols = new List<ApiSymbol>();

        if (doc.RootElement.TryGetProperty("types", out var types))
        {
            foreach (var type in types.EnumerateArray())
            {
                var typeName = type.GetProperty("name").GetString() ?? "";
                if (!type.TryGetProperty("members", out var members)) continue;
                foreach (var member in members.EnumerateArray())
                {
                    symbols.Add(new ApiSymbol(
                        typeName,
                        member.GetProperty("name").GetString() ?? "",
                        member.GetProperty("kind").GetString() ?? "",
                        member.GetProperty("sig").GetString() ?? ""
                    ));
                }
            }
        }

        return new SymbolTable(symbols, hash);
    }

    /// <summary>Fuzzy match: find top-3 suggestions for an unknown identifier.</summary>
    public IReadOnlyList<string> Suggest(string unknown)
    {
        return _symbols
            .Select(s => (sym: s, dist: LevenshteinDistance(unknown.ToLower(), s.MemberName.ToLower())))
            .Where(x => x.dist <= 4)
            .OrderBy(x => x.dist)
            .Take(3)
            .Select(x => $"{x.sym.TypeName}.{x.sym.MemberName}")
            .ToArray();
    }

    public bool IsKnown(string memberName)
        => _symbols.Any(s => string.Equals(s.MemberName, memberName, StringComparison.Ordinal));

    private static int LevenshteinDistance(string a, string b)
    {
        if (a.Length == 0) return b.Length;
        if (b.Length == 0) return a.Length;
        var d = new int[a.Length + 1, b.Length + 1];
        for (int i = 0; i <= a.Length; i++) d[i, 0] = i;
        for (int j = 0; j <= b.Length; j++) d[0, j] = j;
        for (int i = 1; i <= a.Length; i++)
            for (int j = 1; j <= b.Length; j++)
                d[i, j] = Math.Min(
                    Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                    d[i - 1, j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1));
        return d[a.Length, b.Length];
    }
}
