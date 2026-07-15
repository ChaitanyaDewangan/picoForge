// server/main.ts — Entry point
// Boot order: config → db (migrations + orphan repair) → supervisor → server
// SYS_DESIGN §3, §4.4, DATA_SCHEMA §6

import { loadConfig } from "./config.ts";
import { openDb } from "./db/db.ts";
import { repairOrphanRuns } from "./db/repo/runs.ts";
import { buildRouter } from "./http/router.ts";
import { EngineSupervisor } from "./engine/supervisor.ts";
import { log } from "./log.ts";

async function main(): Promise<void> {
  const config = await loadConfig();
  await openDb(config.DATA_DIR);

  // Boot orphan repair — must complete before serving traffic (DATA_SCHEMA §6)
  const orphanIds = repairOrphanRuns();
  if (orphanIds.length > 0) {
    log.warn("Boot: repaired orphan runs", { count: orphanIds.length, ids: orphanIds });
  }

  // Start engine supervisor
  const supervisor = new EngineSupervisor(config.ENGINE_BIN);
  // Non-fatal: engine may not be installed yet (first-run wizard will prompt)
  try {
    await supervisor.start();
  } catch (e) {
    log.warn("Engine supervisor failed to start — running in degraded mode", {
      error: String(e),
    });
  }

  const router = buildRouter(supervisor);

  log.info("Server starting", { host: config.HOST, port: config.PORT });

  await Deno.serve(
    {
      hostname: config.HOST,
      port: config.PORT,
      onListen({ hostname, port }) {
        log.info("Server listening", { url: `http://${hostname}:${port}` });
      },
    },
    router.fetch,
  );
}

main().catch((err) => {
  // Only place in the codebase that may call process exit — top-level unrecoverable
  console.error("Fatal startup error:", err);
  Deno.exit(1);
});
