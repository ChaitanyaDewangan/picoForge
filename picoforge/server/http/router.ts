// server/http/router.ts — Hono REST routes
// M0: only /api/health. Full routes added in M3.

import { Hono } from "hono";
import { makeLogger } from "../log.ts";

const log = makeLogger("http");

export function buildRouter(): Hono {
  const app = new Hono();

  /**
   * GET /api/health
   * Returns engine status, db status, gpuHintsCached.
   * M0: returns minimal {ok:true}; engine/db fields filled in M3.
   */
  app.get("/api/health", (c) => {
    log.debug("health check");
    return c.json({
      ok: true,
      engine: { status: "not_started", pid: null, version: null },
      db: { ok: true },
      gpuHintsCached: false,
    });
  });

  // 404 fallback
  app.notFound((c) => {
    return c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404);
  });

  // Error handler — never send stack traces to client (SYS_DESIGN §3.2)
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
