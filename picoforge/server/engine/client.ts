// server/engine/client.ts — ndjson JSON-RPC client over engine host stdio
// SYS_DESIGN §4.2 — Deno side of the engine IPC
// Full implementation in M3; this module exists for type safety at M0/M1.

import { makeLogger } from "../log.ts";
import { Result, ok, err } from "../domain/result.ts";

const log = makeLogger("engine.client");

export interface EngineHelloResult {
  version: string;
  picogkVersion: string;
  dotnet: string;
  symbolTableHash: string;
}

export interface EngineCompileResult {
  ok: boolean;
  diagnostics: Array<{ id: string; severity: string; line: number; col: number; message: string }>;
  dllCached: boolean;
}

export interface EngineRunParams {
  code?: string;
  codeId?: string;
  runId?: string;
  params?: Record<string, unknown>;
  limits?: { timeoutS?: number; maxRssMiB?: number; maxCells?: number };
  exports?: string[];
  outDir: string;
}

export interface EngineRunResult {
  ok: boolean;
  stats?: {
    volumeCm3: number;
    bboxMin: [number, number, number];
    bboxMax: [number, number, number];
    triangles: number;
    watertight: boolean;
    voxelSizeMm: number;
    minWallProbeMm: number;
    buildMs: number;
  };
  files?: { stl?: string; glb?: string; vdb?: string; report?: string };
  log?: string[];
  error?: { code: string; detail?: string };
}

export type EnginePingResult = { ok: boolean; rssMiB: number; children: number };

/**
 * Client for the forge-engine host process.
 * Communicates via ndjson JSON-RPC over stdio.
 * Stub for M1 — full process management in M3.
 */
export class EngineClient {
  private _process: Deno.ChildProcess | null = null;
  private _seq = 0;
  // deno-lint-ignore no-explicit-any
  private _pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private _ready = false;

  constructor(private readonly engineBin: string) {}

  async start(): Promise<Result<EngineHelloResult, Error>> {
    try {
      const cmd = new Deno.Command(this.engineBin, {
        stdin: "piped",
        stdout: "piped",
        stderr: "inherit",
      });
      this._process = cmd.spawn();
      this._readLoop();
      const hello = await this.call<EngineHelloResult>("engine.hello", {});
      this._ready = true;
      log.info("Engine connected", { version: hello.version });
      return ok(hello);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async ping(): Promise<Result<EnginePingResult, Error>> {
    try {
      return ok(await this.call<EnginePingResult>("engine.ping", {}));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async compile(code: string, codeId?: string): Promise<Result<EngineCompileResult, Error>> {
    try {
      return ok(await this.call<EngineCompileResult>("engine.compile", { code, codeId }));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async run(params: EngineRunParams): Promise<Result<EngineRunResult, Error>> {
    try {
      return ok(await this.call<EngineRunResult>("engine.run", params));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async cancel(runId: string): Promise<void> {
    try { await this.call("engine.cancel", { runId }); } catch { /* best effort */ }
  }

  get isReady(): boolean { return this._ready; }

  private async call<T>(method: string, params: unknown): Promise<T> {
    if (!this._process) throw new Error("Engine not started");
    const id = String(++this._seq);
    const frame = JSON.stringify({ id, method, params }) + "\n";
    const writer = this._process.stdin.getWriter();
    await writer.write(new TextEncoder().encode(frame));
    writer.releaseLock();
    return new Promise<T>((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this._pending.has(id)) {
          this._pending.delete(id);
          reject(new Error(`Engine RPC timeout: ${method}`));
        }
      }, 30_000);
    });
  }

  private async _readLoop(): Promise<void> {
    if (!this._process) return;
    const decoder = new TextDecoder();
    let buf = "";
    for await (const chunk of this._process.stdout) {
      buf += decoder.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id && this._pending.has(msg.id)) {
            const { resolve, reject } = this._pending.get(msg.id)!;
            this._pending.delete(msg.id);
            if (msg.error) reject(new Error(`${msg.error.code}: ${msg.error.message}`));
            else resolve(msg.result);
          } else if (msg.method) {
            // Notification (run.log, run.progress)
            log.debug("Engine notification", { method: msg.method, payload: msg.payload });
          }
        } catch { /* skip malformed frames */ }
      }
    }
  }

  async stop(): Promise<void> {
    this._ready = false;
    try { this._process?.kill(); } catch { }
    this._process = null;
  }
}
