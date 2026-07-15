// server/config.ts — Environment + settings resolution (zod-validated)
// ANTHROPIC_API_KEY is never stored in SQLite, never logged (SYS_DESIGN §3.4)

import { z } from "zod";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { makeLogger } from "./log.ts";

const log = makeLogger("config");

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().min(1024).max(65535).default(7317),
  HOST: z.string().default("127.0.0.1"),
  DATA_DIR: z.string().default(
    join(
      Deno.env.get("USERPROFILE") ?? Deno.env.get("HOME") ?? ".",
      "PicoForge",
    ),
  ),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  ENGINE_BIN: z.string().default("forge-engine"),
  /** Never echo this value in logs or HTTP responses */
  ANTHROPIC_API_KEY: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

let _config: Config | null = null;

async function loadApiKey(dataDir: string): Promise<string | undefined> {
  // Prefer env; fallback to ~/PicoForge/secret.env
  const fromEnv = Deno.env.get("ANTHROPIC_API_KEY");
  if (fromEnv) return fromEnv;
  try {
    const secretPath = join(dataDir, "secret.env");
    const text = await Deno.readTextFile(secretPath);
    const match = text.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

/**
 * Persist a new API key to ~/PicoForge/secret.env and hot-reload config.
 * Key is NEVER logged. Returns true on success.
 */
export async function writeApiKey(newKey: string): Promise<boolean> {
  try {
    const cfg = getConfig();
    const secretPath = join(cfg.DATA_DIR, "secret.env");
    let existing = "";
    try {
      existing = await Deno.readTextFile(secretPath);
    } catch { /* new file */ }
    // Replace or append the key line — keep any other lines untouched
    const updated = existing.includes("ANTHROPIC_API_KEY=")
      ? existing.replace(/^ANTHROPIC_API_KEY=.+$/m, `ANTHROPIC_API_KEY=${newKey}`)
      : existing + `\nANTHROPIC_API_KEY=${newKey}`;
    await Deno.writeTextFile(secretPath, updated.trim() + "\n");
    // Hot-reload: update in-memory config (no restart needed)
    _config = { ...cfg, ANTHROPIC_API_KEY: newKey };
    log.info("API key updated", { hasKey: true }); // never log key value
    return true;
  } catch (e) {
    log.error("Failed to write API key", { error: String(e) });
    return false;
  }
}

export async function loadConfig(): Promise<Config> {
  if (_config) return _config;

  const raw = {
    PORT: Deno.env.get("PORT"),
    HOST: Deno.env.get("HOST"),
    DATA_DIR: Deno.env.get("DATA_DIR"),
    NODE_ENV: Deno.env.get("NODE_ENV"),
    ENGINE_BIN: Deno.env.get("ENGINE_BIN"),
  };

  const partial = ConfigSchema.omit({ ANTHROPIC_API_KEY: true }).parse(raw);
  const apiKey = await loadApiKey(partial.DATA_DIR);

  _config = ConfigSchema.parse({ ...raw, ANTHROPIC_API_KEY: apiKey });

  await Deno.mkdir(join(_config.DATA_DIR, "logs"), { recursive: true });
  await Deno.mkdir(join(_config.DATA_DIR, "projects"), { recursive: true });
  await Deno.mkdir(join(_config.DATA_DIR, "tmp"), { recursive: true });
  await Deno.mkdir(join(_config.DATA_DIR, "kb"), { recursive: true });

  log.info("Config loaded", {
    port: _config.PORT,
    dataDir: _config.DATA_DIR,
    env: _config.NODE_ENV,
    hasApiKey: !!_config.ANTHROPIC_API_KEY,
    // NEVER log the key itself
  });

  return _config;
}

export function getConfig(): Config {
  if (!_config) throw new Error("Config not loaded — call loadConfig() first");
  return _config;
}
