// ForgeEngine/Rpc.cs — ndjson JSON-RPC framing over stdio
// One JSON object per line. SYS_DESIGN §4.2

using System.Text.Json;
using System.Text.Json.Nodes;

namespace ForgeEngine;

/// <summary>A parsed inbound JSON-RPC request frame.</summary>
public sealed class RpcRequest
{
    public string? Id { get; init; }
    public required string Method { get; init; }
    public JsonNode? Params { get; init; }

    public static RpcRequest? TryParse(string line)
    {
        if (string.IsNullOrWhiteSpace(line)) return null;
        try
        {
            var node = JsonNode.Parse(line);
            var method = node?["method"]?.GetValue<string>();
            if (method is null) return null;
            return new RpcRequest
            {
                Id = node?["id"]?.GetValue<string>(),
                Method = method,
                Params = node?["params"],
            };
        }
        catch { return null; }
    }
}

/// <summary>Write ndjson response frames to stdout.</summary>
public static class RpcWriter
{
    private static readonly Lock _lock = new();

    public static void WriteResult(string? id, object result)
    {
        var frame = JsonSerializer.Serialize(new { id, result });
        WriteFrame(frame);
    }

    public static void WriteError(string? id, string code, string message)
    {
        var frame = JsonSerializer.Serialize(new { id, error = new { code, message } });
        WriteFrame(frame);
    }

    public static void WriteNotification(string method, object payload)
    {
        var frame = JsonSerializer.Serialize(new { method, payload });
        WriteFrame(frame);
    }

    private static void WriteFrame(string frame)
    {
        lock (_lock)
        {
            Console.WriteLine(frame);
            Console.Out.Flush();
        }
    }
}
