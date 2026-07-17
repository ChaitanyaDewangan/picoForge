import { dirname, fromFileUrl, join } from "https://deno.land/std@0.224.0/path/mod.ts";

const rootDir = join(dirname(fromFileUrl(import.meta.url)), "..");

async function runCommand(cmd: string[]) {
  const process = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    cwd: rootDir,
    stdout: "inherit",
    stderr: "inherit",
  });
  const output = await process.output();
  if (!output.success) {
    throw new Error(`Command failed: ${cmd.join(" ")}`);
  }
}

async function build() {
  console.log("=== Building PicoForge ===");

  console.log("\n1. Building Vite Frontend...");
  await runCommand([
    Deno.build.os === "windows" ? "npm.cmd" : "npm",
    "run",
    "build",
    "--prefix",
    "app",
  ]);

  console.log("\n2. Building ForgeEngine (C#)...");
  try {
    await runCommand([
      "dotnet",
      "publish",
      "server/engine/ForgeEngine/ForgeEngine.csproj",
      "-c",
      "Release",
      "-o",
      "dist/engine",
    ]);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      console.log("   [WARN] dotnet SDK not found, skipping engine build.");
    } else {
      throw err;
    }
  }

  console.log("\n3. Compiling Deno Backend...");
  // We include app/dist for frontend serving and bin/engine_publish for the engine
  await runCommand([
    "deno",
    "compile",
    "--allow-all",
    "--output",
    "picoforged",
    "--include",
    "server/public",
    "server/main.ts",
  ]);

  console.log("\n=== Build Complete ===");
  console.log("Executable created: picoforged");
  console.log(
    "NOTE: You must distribute the bin/engine_publish folder alongside the executable if the OS cannot run dotnet natively.",
  );
}

build().catch((err) => {
  console.error("Build failed:", err);
  Deno.exit(1);
});
