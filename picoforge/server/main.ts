// server/main.ts — Entry point
// Boot order: config → db (migrations) → server
// SYS_DESIGN §3, AGENTS §3

import { loadConfig } from "./config.ts";
import { openDb } from "./db/db.ts";
import { buildRouter } from "./http/router.ts";
import { log } from "./log.ts";

async function main(): Promise<void> {
  const config = await loadConfig();
  await openDb(config.DATA_DIR);

  const router = buildRouter();

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
