// DumpApi/Program.cs — Full reflection walker: PicoGK.dll + Kit.dll → picogk_api.json
// This is the critical link that makes "what the model is told exists" = "what actually compiles"
// SYS_DESIGN §4.1, PICOGK_KNOWLEDGE §1

using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

var outPath = args.Length > 0 ? args[0] : "picogk_api.json";

// Walk the PicoGK and PicoForge.Kit assemblies (loaded via ForgeSandbox project reference)
var assemblies = AppDomain.CurrentDomain.GetAssemblies()
    .Where(a => !a.IsDynamic)
    .ToArray();

var targetNamespaces = new HashSet<string>(StringComparer.Ordinal)
{
    "PicoGK",
    "PicoForge.Kit",
};

var types = new List<ApiType>();
var generatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

foreach (var asm in assemblies)
{
    Type[] publicTypes;
    try { publicTypes = asm.GetExportedTypes(); }
    catch { continue; }

    foreach (var type in publicTypes)
    {
        if (!targetNamespaces.Contains(type.Namespace ?? "")) continue;
        if (type.IsNested) continue;

        var members = new List<ApiMember>();

        // Methods
        foreach (var method in type.GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance)
            .Where(m => !m.IsSpecialName && m.DeclaringType == type))
        {
            members.Add(new ApiMember
            {
                Name = method.Name,
                Kind = "method",
                Sig = BuildMethodSig(method),
                Doc = TruncateDoc($"{method.ReturnType.Name} {method.Name}({ParamList(method)})", 12),
            });
        }

        // Properties
        foreach (var prop in type.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static)
            .Where(p => p.DeclaringType == type))
        {
            members.Add(new ApiMember
            {
                Name = prop.Name,
                Kind = "property",
                Sig = $"{ShortType(prop.PropertyType)} {prop.Name} {{ {(prop.CanRead ? "get;" : "")} {(prop.CanWrite ? "set;" : "")} }}",
                Doc = TruncateDoc($"{ShortType(prop.PropertyType)} {prop.Name}", 12),
            });
        }

        // Fields
        foreach (var field in type.GetFields(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static)
            .Where(f => f.DeclaringType == type && !f.IsSpecialName))
        {
            members.Add(new ApiMember
            {
                Name = field.Name,
                Kind = "field",
                Sig = $"{ShortType(field.FieldType)} {field.Name}",
                Doc = TruncateDoc($"{ShortType(field.FieldType)} {field.Name}", 12),
            });
        }

        types.Add(new ApiType
        {
            Name = type.Name,
            Namespace = type.Namespace ?? "",
            Members = members.ToArray(),
        });
    }
}

// Build banned namespaces list for Roslyn analyzer
var bannedNamespaces = new[]
{
    "System.IO", "System.Net", "System.Reflection.Emit",
    "System.Diagnostics", "System.Threading", "System.AppDomain",
    "System.Environment",
};

// Get PicoGK version from assembly if possible
var picogkVersion = AppDomain.CurrentDomain.GetAssemblies()
    .FirstOrDefault(a => a.GetName().Name == "PicoGK")
    ?.GetName().Version?.ToString() ?? "unknown";

var manifest = new ApiManifest
{
    Version = "1.0.0-m1",
    PicoGKVersion = picogkVersion,
    GeneratedAt = generatedAt,
    Types = types.ToArray(),
    BannedNamespaces = bannedNamespaces,
};

var jsonOptions = new JsonSerializerOptions
{
    WriteIndented = true,
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
};
var json = JsonSerializer.Serialize(manifest, jsonOptions);
await File.WriteAllTextAsync(outPath, json, Encoding.UTF8);

var typeCount = types.Count;
var memberCount = types.Sum(t => t.Members.Length);
Console.WriteLine($"DumpApi: wrote {typeCount} types, {memberCount} members → {outPath}");
Console.WriteLine($"DumpApi: PicoGK version = {picogkVersion}");

// ─── Helpers ──────────────────────────────────────────────────────────────

static string BuildMethodSig(MethodInfo m)
{
    var sb = new StringBuilder();
    if (m.IsStatic) sb.Append("static ");
    sb.Append(ShortType(m.ReturnType));
    sb.Append(' ');
    sb.Append(m.Name);
    sb.Append('(');
    sb.Append(ParamList(m));
    sb.Append(')');
    return sb.ToString();
}

static string ParamList(MethodInfo m)
    => string.Join(", ", m.GetParameters().Select(p => $"{ShortType(p.ParameterType)} {p.Name}"));

static string ShortType(Type t)
{
    if (t == typeof(void)) return "void";
    if (t == typeof(bool)) return "bool";
    if (t == typeof(int)) return "int";
    if (t == typeof(float)) return "float";
    if (t == typeof(double)) return "double";
    if (t == typeof(string)) return "string";
    if (t.IsGenericType)
        return t.Name.Split('`')[0] + "<" + string.Join(",", t.GenericTypeArguments.Select(ShortType)) + ">";
    return t.Name;
}

static string TruncateDoc(string doc, int maxWords)
{
    var words = doc.Split(' ', StringSplitOptions.RemoveEmptyEntries);
    return words.Length <= maxWords ? doc : string.Join(' ', words.Take(maxWords)) + "…";
}

// ─── Record types ─────────────────────────────────────────────────────────

public record ApiManifest
{
    [JsonPropertyName("version")]          public required string Version { get; init; }
    [JsonPropertyName("picogkVersion")]    public required string PicoGKVersion { get; init; }
    [JsonPropertyName("generatedAt")]      public required long GeneratedAt { get; init; }
    [JsonPropertyName("types")]            public required ApiType[] Types { get; init; }
    [JsonPropertyName("bannedNamespaces")] public required string[] BannedNamespaces { get; init; }
}

public record ApiType
{
    [JsonPropertyName("name")]      public required string Name { get; init; }
    [JsonPropertyName("namespace")] public required string Namespace { get; init; }
    [JsonPropertyName("members")]   public required ApiMember[] Members { get; init; }
}

public record ApiMember
{
    [JsonPropertyName("name")] public required string Name { get; init; }
    [JsonPropertyName("kind")] public required string Kind { get; init; }
    [JsonPropertyName("sig")]  public required string Sig { get; init; }
    [JsonPropertyName("doc")]  public string? Doc { get; init; }
}
