// server/harness/tests/systemPrompt.test.ts — prompt renderer tests
// LLM_HARNESS §11: token count assertion, substitution completeness

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.0";
import { buildSystemPrompt, estimateTokens } from "../prompts/system.ts";

Deno.test("system prompt: renders without placeholders", () => {
  const prompt = buildSystemPrompt();
  // All {{X}} substitutions must be gone
  const unresolved = [...prompt.matchAll(/\{\{[A-Z_]+\}\}/g)];
  assertEquals(
    unresolved.length,
    0,
    `Unresolved placeholders: ${unresolved.map((m) => m[0]).join(", ")}`,
  );
});

Deno.test("system prompt: contains Code Contract", () => {
  const prompt = buildSystemPrompt();
  assertStringIncludes(prompt, "public static class Design");
  assertStringIncludes(prompt, "voxBuild");
});

Deno.test("system prompt: contains material table", () => {
  const prompt = buildSystemPrompt();
  assertStringIncludes(prompt, "PETG");
  assertStringIncludes(prompt, "Al6061-T6");
  assertStringIncludes(prompt, "SS316L");
});

Deno.test("system prompt: contains working loop steps", () => {
  const prompt = buildSystemPrompt();
  assertStringIncludes(prompt, "UNDERSTAND");
  assertStringIncludes(prompt, "ENGINEER");
  assertStringIncludes(prompt, "BUILD");
  assertStringIncludes(prompt, "VERIFY");
  assertStringIncludes(prompt, "REPORT");
});

Deno.test("system prompt: token estimate under 9k without API card", () => {
  const prompt = buildSystemPrompt();
  const tokens = estimateTokens(prompt);
  assertEquals(tokens < 9000, true, `Prompt too long: ~${tokens} tokens`);
});

Deno.test("system prompt: injects custom material and envelope", () => {
  const prompt = buildSystemPrompt({
    projectMaterial: "Al6061-T6",
    envelopeMm: { x: 200, y: 150, z: 80 },
    cellCap: 200_000_000,
    timeoutS: 60,
  });
  assertStringIncludes(prompt, "Al6061-T6");
  assertStringIncludes(prompt, "200 × 150 × 80");
  assertStringIncludes(prompt, "200,000,000");
  assertStringIncludes(prompt, "60 s");
});

Deno.test("system prompt: banned API list present", () => {
  const prompt = buildSystemPrompt();
  assertStringIncludes(prompt, "FORBIDDEN");
  assertStringIncludes(prompt, "DateTime.Now");
  assertStringIncludes(prompt, "new Random()");
});
