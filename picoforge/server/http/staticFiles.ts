// server/http/staticFiles.ts — Artifact file serving
// SYS_DESIGN §3.2: /files/* → artifact dir, with ETag + Range support

import { makeLogger } from "../log.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { getConfig } from "../config.ts";
import type { Context } from "hono";

const log = makeLogger("static");

const MIME: Record<string, string> = {
  stl: "model/stl",
  glb: "model/gltf-binary",
  vdb: "application/octet-stream",
  png: "image/png",
  json: "application/json",
  "3mf": "model/3mf",
};

function mimeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

/** GET /files/:path* — serve artifact files from DATA_DIR */
export async function serveFile(c: Context): Promise<Response> {
  const config = getConfig();
  const relPath = c.req.param("path");
  if (!relPath) return c.json({ error: { code: "NOT_FOUND", message: "No path" } }, 404);

  // Security: no path traversal
  const cleaned = relPath.replace(/\.\.\//g, "").replace(/\\/g, "/");
  const absPath = join(config.DATA_DIR, cleaned);

  try {
    const stat = await Deno.stat(absPath);
    if (!stat.isFile) {
      return c.json({ error: { code: "NOT_FOUND", message: "Not a file" } }, 404);
    }

    const etag = `"${stat.size}-${stat.mtime?.getTime() ?? 0}"`;
    const ifNoneMatch = c.req.header("if-none-match");
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    const rangeHeader = c.req.header("range");
    const contentType = mimeFor(absPath);

    if (rangeHeader) {
      // Range request
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (!match) {
        return c.json({ error: { code: "BAD_RANGE", message: "Invalid Range header" } }, 416);
      }
      const start = match[1] ? parseInt(match[1]) : 0;
      const end = match[2] ? parseInt(match[2]) : stat.size - 1;
      const chunkSize = end - start + 1;

      const file = await Deno.open(absPath);
      await file.seek(start, Deno.SeekMode.Start);
      const buf = new Uint8Array(chunkSize);
      await file.read(buf);
      file.close();

      return new Response(buf, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Content-Length": String(chunkSize),
          ETag: etag,
          "Accept-Ranges": "bytes",
        },
      });
    }

    // Full file
    const data = await Deno.readFile(absPath);
    return new Response(data, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(stat.size),
        ETag: etag,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return c.json({ error: { code: "NOT_FOUND", message: "File not found" } }, 404);
    }
    const errId = crypto.randomUUID();
    log.error("File serve error", { errId, path: absPath, error: String(e) });
    return c.json({ error: { code: "INTERNAL", message: "File read error", errId } }, 500);
  }
}
