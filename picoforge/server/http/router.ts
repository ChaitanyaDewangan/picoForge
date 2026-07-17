// server/http/router.ts — Hono REST routes + WS upgrade
// SYS_DESIGN §3.2 — all routes with zod input parsing + typed errors

import { Hono } from "hono";
import { z } from "zod";
import { makeLogger } from "../log.ts";
import { broadcast, handleWsUpgrade } from "./ws.ts";
import { serveFile } from "./staticFiles.ts";
import {
  projectCreate,
  projectDelete,
  projectGet,
  projectList,
  ProjectSettingsSchema,
  projectUpdate,
} from "../db/repo/projects.ts";
import { conversationCreate, conversationGet, conversationList } from "../db/repo/conversations.ts";
import { messageList } from "../db/repo/messages.ts";
import { artifactGet } from "../db/repo/runs.ts";
import { settingsGet, SettingsSchema, settingsSet } from "../db/repo/settings.ts";
import { writeApiKey, writeBaseUrl, clearBaseUrl, getConfig } from "../config.ts";
import { AVAILABLE_MODELS } from "../harness/anthropic.ts";
import type { EngineSupervisor } from "../engine/supervisor.ts";

const log = makeLogger("http");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errRes(code: string, message: string) {
  return { error: { code, message } } as const;
}

/** Parse JSON body and validate with zod; returns null on failure (caller sends 422) */
async function parseBody<T>(
  c: { req: { json: () => Promise<unknown> } },
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; issues: z.ZodIssue[] }> {
  try {
    const raw = await c.req.json();
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { ok: false, issues: parsed.error.issues };
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, issues: [{ code: "custom", message: "Invalid JSON body", path: [] }] };
  }
}

// ─── Router factory ──────────────────────────────────────────────────────────

export function buildRouter(supervisor?: EngineSupervisor): Hono {
  const app = new Hono();

  // ── GET /api/health ────────────────────────────────────────────────────────
  app.get("/api/health", (c) => {
    log.debug("health check");
    const engineState = supervisor?.state ?? {
      status: "down",
      pid: null,
      version: null,
      restarts: 0,
      lastHeartbeat: null,
    };
    return c.json({
      ok: engineState.status === "ok" || engineState.status === "degraded",
      engine: {
        status: engineState.status,
        pid: engineState.pid,
        version: engineState.version,
      },
      db: { ok: true },
      gpuHintsCached: false,
    });
  });

  // ── Projects ───────────────────────────────────────────────────────────────

  app.get("/api/projects", (c) => {
    return c.json({ projects: projectList() });
  });

  app.post("/api/projects", async (c) => {
    const parsed = await parseBody(
      c,
      z.object({
        name: z.string().min(1).max(200),
        settings: ProjectSettingsSchema.optional(),
      }),
    );
    if (!parsed.ok) return c.json(errRes("INVALID_INPUT", "Validation failed"), 422);
    const project = projectCreate(parsed.data.name, parsed.data.settings ?? {});
    return c.json({ project }, 201);
  });

  app.get("/api/projects/:id", (c) => {
    const project = projectGet(c.req.param("id"));
    if (!project) return c.json(errRes("NOT_FOUND", "Project not found"), 404);
    return c.json({ project });
  });

  app.patch("/api/projects/:id", async (c) => {
    const parsed = await parseBody(
      c,
      z.object({
        name: z.string().min(1).max(200).optional(),
        archived: z.boolean().optional(),
        settings: ProjectSettingsSchema.partial().optional(),
      }),
    );
    if (!parsed.ok) return c.json(errRes("INVALID_INPUT", "Validation failed"), 422);
    const updated = projectUpdate(c.req.param("id"), parsed.data);
    if (!updated) return c.json(errRes("NOT_FOUND", "Project not found"), 404);
    return c.json({ project: updated });
  });

  app.delete("/api/projects/:id", (c) => {
    const deleted = projectDelete(c.req.param("id"));
    if (!deleted) return c.json(errRes("NOT_FOUND", "Project not found"), 404);
    return c.json({ ok: true });
  });

  // ── Conversations ──────────────────────────────────────────────────────────

  app.get("/api/projects/:id/conversations", (c) => {
    const project = projectGet(c.req.param("id"));
    if (!project) return c.json(errRes("NOT_FOUND", "Project not found"), 404);
    return c.json({ conversations: conversationList(c.req.param("id")) });
  });

  app.post("/api/projects/:id/conversations", async (c) => {
    const project = projectGet(c.req.param("id"));
    if (!project) return c.json(errRes("NOT_FOUND", "Project not found"), 404);
    const parsed = await parseBody(c, z.object({ title: z.string().max(300).optional() }));
    if (!parsed.ok) return c.json(errRes("INVALID_INPUT", "Validation failed"), 422);
    const conversation = conversationCreate(c.req.param("id"), parsed.data.title);
    return c.json({ conversation }, 201);
  });

  // ── Messages ───────────────────────────────────────────────────────────────

  app.get("/api/conversations/:id/messages", (c) => {
    const conv = conversationGet(c.req.param("id"));
    if (!conv) return c.json(errRes("NOT_FOUND", "Conversation not found"), 404);
    const after = c.req.query("after") ? Number(c.req.query("after")) : undefined;
    return c.json({ messages: messageList(c.req.param("id"), after) });
  });

  // ── Cancel run ─────────────────────────────────────────────────────────────

  app.post("/api/conversations/:id/cancel", async (c) => {
    const parsed = await parseBody(c, z.object({ runId: z.string() }));
    if (!parsed.ok) return c.json(errRes("INVALID_INPUT", "runId required"), 422);
    await supervisor?.client?.cancel(parsed.data.runId);
    return c.json({ ok: true });
  });

  // ── Artifacts ──────────────────────────────────────────────────────────────

  app.get("/api/artifacts/:id", (c) => {
    const artifact = artifactGet(c.req.param("id"));
    if (!artifact) return c.json(errRes("NOT_FOUND", "Artifact not found"), 404);
    return c.json({ artifact });
  });

  // ── Models (available models list for UI) ──────────────────────────────────

  app.get("/api/models", (c) => {
    return c.json({ models: AVAILABLE_MODELS });
  });

  // ── Settings ───────────────────────────────────────────────────────────────

  app.get("/api/settings", (c) => {
    const settings = settingsGet();
    // Include provider info (never expose actual key value)
    let hasApiKey = false;
    let apiBaseUrl: string | undefined;
    try {
      const cfg = getConfig();
      hasApiKey = !!cfg.ANTHROPIC_API_KEY;
      apiBaseUrl = cfg.ANTHROPIC_BASE_URL;
    } catch { /* config not loaded yet */ }
    return c.json({ settings, provider: { hasApiKey, apiBaseUrl } });
  });

  app.put("/api/settings", async (c) => {
    // Allow apiKey + apiBaseUrl in PUT body — written to keystore, never to DB
    const BodySchema = SettingsSchema.partial().extend({
      apiKey: z.string().min(10).optional(),
      apiBaseUrl: z.string().url().optional().or(z.literal("")),
    });
    const parsed = await parseBody(c, BodySchema);
    if (!parsed.ok) return c.json(errRes("INVALID_INPUT", "Validation failed"), 422);
    const { apiKey, apiBaseUrl, ...patch } = parsed.data;
    // Persist API key to keystore (never DB, never logged)
    if (apiKey) {
      const ok = await writeApiKey(apiKey);
      if (!ok) {
        return c.json(errRes("KEYSTORE_WRITE_FAILED", "Could not write key to keystore"), 500);
      }
    }
    // Persist base URL to keystore (or clear if empty)
    if (apiBaseUrl !== undefined) {
      const ok = apiBaseUrl
        ? await writeBaseUrl(apiBaseUrl)
        : await clearBaseUrl();
      if (!ok) {
        return c.json(errRes("KEYSTORE_WRITE_FAILED", "Could not write base URL to keystore"), 500);
      }
    }
    const settings = settingsSet(patch as Parameters<typeof settingsSet>[0]);
    return c.json({ settings });
  });

  // ── Test API key ──────────────────────────────────────────────────────────

  app.post("/api/settings/test-key", async (c) => {
    const parsed = await parseBody(c, z.object({
      key: z.string().min(10),
      baseUrl: z.string().url().optional(),
    }));
    if (!parsed.ok) return c.json(errRes("INVALID_INPUT", "key required"), 422);
    try {
      // 1-token ping to verify key works — cheapest possible call
      const { default: Anthropic } = await import("npm:@anthropic-ai/sdk@^0.54.0");
      const client = new Anthropic({
        apiKey: parsed.data.key,
        ...(parsed.data.baseUrl ? { baseURL: parsed.data.baseUrl } : {}),
      });
      await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      });
      return c.json({ ok: true });
    } catch (e) {
      const status = (e as { status?: number }).status;
      // 401 = bad key; 4xx = key ok but other issue; log errId only
      const errId = crypto.randomUUID();
      log.warn("API key test failed", { errId, status });
      return c.json({ ok: false, errId }, status === 401 ? 401 : 400);
    }
  });

  // ── Self-test ──────────────────────────────────────────────────────────────

  app.post("/api/selftest", async (c) => {
    if (!supervisor?.client?.isReady) {
      return new Response(JSON.stringify(errRes("ENGINE_NOT_READY", "Engine not running")), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
    const result = await supervisor.client.run({
      code: `
using PicoGK;
public class Design {
  public static Voxels voxBuild(Library.Config cfg) {
    var b = new BBox3((float)cfg.fVoxelSizeMm*2,(float)cfg.fVoxelSizeMm*2,(float)cfg.fVoxelSizeMm*2,
                      20f-((float)cfg.fVoxelSizeMm*2),20f-((float)cfg.fVoxelSizeMm*2),20f-((float)cfg.fVoxelSizeMm*2));
    return Voxels.CreateFromMesh(Mesh.CreateBox(b), cfg.fVoxelSizeMm);
  }
}`,
      outDir: "",
      exports: ["stl"],
    });
    if (result.ok) return c.json({ ok: true, stats: result.value.stats });
    return new Response(JSON.stringify({ ok: false, error: result.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  });

  // ── WebSocket upgrade ──────────────────────────────────────────────────────

  app.get("/ws", (c) => {
    const convId = c.req.query("conversationId");
    if (!convId) return c.json(errRes("MISSING_PARAM", "conversationId required"), 400);
    const conv = conversationGet(convId);
    if (!conv) return c.json(errRes("NOT_FOUND", "Conversation not found"), 404);

    return handleWsUpgrade(c.req.raw, convId, (conversationId, _sessionId, event) => {
      // Route client events
      const ev = event as { type: string; runId?: string; text?: string };
      if (ev.type === "run.cancel" && ev.runId) {
        supervisor?.client?.cancel(ev.runId);
      }
      // user.message and viewport.capture.result are handled by the harness
      // broadcast is wired in by the orchestrator
      log.debug("WS client event", { conversationId, type: ev.type });
    });
  });

  // ── Static files ──────────────────────────────────────────────────────────

  app.get("/files/:path{.+}", serveFile);

  // ── 404 fallback ──────────────────────────────────────────────────────────

  app.notFound((c) => {
    return c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404);
  });

  // ── Error handler ─────────────────────────────────────────────────────────

  app.onError((err, c) => {
    const errId = crypto.randomUUID();
    log.error("Unhandled request error", { errId, message: err.message, stack: err.stack });
    return c.json(
      { error: { code: "INTERNAL", message: "An internal error occurred", errId } },
      500,
    );
  });

  return app;
}

export { broadcast };
