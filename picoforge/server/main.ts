// server/main.ts — Entry point
// Boot order: config → db (migrations + orphan repair) → supervisor → server
// SYS_DESIGN §3, §4.4, DATA_SCHEMA §6

import { getBootToken, loadConfig } from "./config.ts";
import { openDb } from "./db/db.ts";
import { repairOrphanRuns } from "./db/repo/runs.ts";
import { buildRouter } from "./http/router.ts";
import { EngineSupervisor } from "./engine/supervisor.ts";
import { log } from "./log.ts";
import { runGc } from "./db/gc.ts";
import { launchDesktopApp } from "./desktop.ts";

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

  // Handle CLI arguments
  const args = Deno.args;
  const isSelftest = args.includes("--selftest");
  const isHeadless = args.includes("--headless");

  if (isSelftest) {
    log.info("Running self-test...");
    if (supervisor.client) {
      try {
        const res = await supervisor.client.ping();
        if (res.ok) {
          log.info("Self-test passed: Engine is ready.");
          Deno.exit(0);
        } else {
          log.error("Self-test failed: Engine ping error", { error: String(res.error) });
          Deno.exit(1);
        }
      } catch (err) {
        log.error("Self-test failed: Engine ping error", { error: String(err) });
        Deno.exit(1);
      }
    } else {
      log.error("Self-test failed: Engine supervisor not connected.");
      Deno.exit(1);
    }
  }

  const router = buildRouter(supervisor);

  log.info("Server starting", { host: config.HOST, port: config.PORT });

  // Generate and display boot token for security
  const token = getBootToken();

  await Deno.serve(
    {
      hostname: config.HOST,
      port: config.PORT,
      onListen({ hostname, port }) {
        const url = `http://${
          hostname === "127.0.0.1" || hostname === "0.0.0.0" ? "localhost" : hostname
        }:${port}`;
        log.info("Server listening", { url });

        // Print token to console (SYS_DESIGN §10)
        console.log(`\n  ╭───────────────────────────────────────────────────╮`);
        console.log(`  │  PicoForge server ready                          │`);
        console.log(`  │  URL:   ${url.padEnd(40)}│`);
        console.log(`  │  Token: ${token.substring(0, 36).padEnd(40)}│`);
        console.log(`  ╰───────────────────────────────────────────────────╯\n`);

        // Launch desktop window unless headless
        if (!isHeadless) {
          launchDesktopApp(`${url}?t=${token}`);
        }
      },
    },
    router.fetch,
  );

  // Schedule Retention GC to run quietly after 30s boot-idle
  setTimeout(() => {
    runGc().catch((err) => log.error("Boot GC failed", { error: String(err) }));
  }, 30_000);
}

main().catch((err) => {
  // Only place in the codebase that may call process exit — top-level unrecoverable
  console.error("Fatal startup error:", err);
  Deno.exit(1);
});
