// server/log.ts — Structured ndjson logger
// Writes to ~/PicoForge/logs/server.log; never logs secrets.

import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  ts: number;
  level: LogLevel;
  area: string;
  message: string;
  data?: Record<string, unknown>;
}

const LOG_DIR = join(
  Deno.env.get("USERPROFILE") ?? Deno.env.get("HOME") ?? ".",
  "PicoForge",
  "logs",
);

let logFile: Deno.FsFile | null = null;

async function ensureLogFile(): Promise<Deno.FsFile> {
  if (logFile) return logFile;
  await Deno.mkdir(LOG_DIR, { recursive: true });
  logFile = await Deno.open(join(LOG_DIR, "server.log"), {
    write: true,
    append: true,
    create: true,
  });
  return logFile;
}

async function writeEntry(entry: LogEntry): Promise<void> {
  const line = JSON.stringify(entry) + "\n";
  // Always write to stdout in dev
  if (entry.level === "error" || entry.level === "warn") {
    console.error(line.trimEnd());
  } else {
    console.log(line.trimEnd());
  }
  try {
    const f = await ensureLogFile();
    await f.write(new TextEncoder().encode(line));
  } catch {
    // Swallow log write errors — never crash the server over logging
  }
}

function makeLogger(area: string) {
  return {
    debug: (message: string, data?: Record<string, unknown>) =>
      writeEntry({ ts: Date.now(), level: "debug", area, message, data }),
    info: (message: string, data?: Record<string, unknown>) =>
      writeEntry({ ts: Date.now(), level: "info", area, message, data }),
    warn: (message: string, data?: Record<string, unknown>) =>
      writeEntry({ ts: Date.now(), level: "warn", area, message, data }),
    error: (message: string, data?: Record<string, unknown>) =>
      writeEntry({ ts: Date.now(), level: "error", area, message, data }),
  };
}

export { makeLogger };
export const log = makeLogger("server");
