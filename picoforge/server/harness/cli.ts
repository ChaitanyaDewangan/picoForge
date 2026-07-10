// server/harness/cli.ts — CLI runner for headless harness testing
// deno task harness:once "build a fan impeller with 5 blades, 80mm diameter"
// LLM_HARNESS §2 M2 gate: "CLI runner deno task harness:once 'prompt' against real engine"

import { driveRun } from "./orchestrator.ts";

const userPrompt = Deno.args.join(" ").trim();
if (!userPrompt) {
  console.error("Usage: deno task harness:once <prompt>");
  Deno.exit(1);
}

const runId = `cli-${Date.now()}`;
const conversationId = `cli-conv-${Date.now()}`;

console.log(`\n[harness:once] run=${runId}`);
console.log(`[harness:once] prompt: "${userPrompt}"\n`);

const ac = new AbortController();

// Handle Ctrl+C gracefully
Deno.addSignalListener("SIGINT", () => {
  console.log("\n[harness:once] cancelled by user");
  ac.abort();
});

const { state } = await driveRun({
  runId,
  projectId: "cli",
  conversationId,
  userMessage: userPrompt,
  history: [],
  signal: ac.signal,
  callbacks: {
    onStateChange: (_id, s) => console.log(`  → state: ${s}`),
    onTextDelta: (_id, delta) => process.stdout.write(delta),
    onGeometryReady: (_id, artifactId, stats) => {
      console.log(`\n\n[harness:once] ✅ geometry ready: artifactId=${artifactId}`);
      console.log(JSON.stringify(stats, null, 2));
    },
    onError: (_id, code, detail) => {
      console.error(`\n[harness:once] ❌ error: ${code}`);
      console.error(detail);
    },
  },
});

console.log(`\n[harness:once] final state: ${state}`);
Deno.exit(state === "done" || state === "awaiting_user" ? 0 : 1);
