// scripts/setup.ts — Setup script: dotnet restore, build engine, run DumpApi, ingest docs
// Called by: deno task setup
// AGENTS.md §4 M0 — prerequisite for all other milestones

import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { makeLogger } from "../server/log.ts";

const log = makeLogger("setup");
const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

async function run(cmd: string[], cwd?: string): Promise<void> {
  const label = cmd.join(" ");
  log.info(`Running: ${label}`, { cwd });
  const proc = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    cwd: cwd ?? ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await proc.output();
  if (code !== 0) {
    throw new Error(`Command failed (exit ${code}): ${label}`);
  }
}

async function step(name: string, fn: () => Promise<void>): Promise<void> {
  log.info(`=== ${name} ===`);
  try {
    await fn();
    log.info(`✓ ${name}`);
  } catch (e) {
    log.error(`✗ ${name}`, { error: String(e) });
    throw e;
  }
}

async function main(): Promise<void> {
  log.info("PicoForge setup starting", { root: ROOT });

  await step("dotnet restore", async () => {
    await run(["dotnet", "restore", "engine/PicoForge.sln"]);
  });

  await step("dotnet build (Debug)", async () => {
    await run(["dotnet", "build", "engine/PicoForge.sln", "--no-restore", "-c", "Debug"]);
  });

  await step("DumpApi → picogk_api.json", async () => {
    const outPath = join(ROOT, "picogk_api.json");
    await run([
      "dotnet",
      "run",
      "--project",
      join(ROOT, "engine", "tools", "DumpApi"),
      "--no-build",
      "--",
      outPath,
    ]);
    log.info("picogk_api.json written", { path: outPath });
  });

  await step("npm install (app)", async () => {
    await run(["npm", "install"], join(ROOT, "app"));
  });

  log.info("Setup complete — run `deno task dev` to start");
}

main().catch((e) => {
  console.error("Setup failed:", e);
  Deno.exit(1);
});
