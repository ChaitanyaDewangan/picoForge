// server/engine/supervisor.ts — Engine host supervisor
// SYS_DESIGN §4.4: heartbeat every 5s, backoff restart, orphan run repair
// Full DB integration in M3; this module manages the process lifecycle.

import { makeLogger } from "../log.ts";
import { EngineClient } from "./client.ts";

const log = makeLogger("engine.supervisor");

export type EngineStatus = "starting" | "ok" | "degraded" | "down";

export interface SupervisorState {
  status: EngineStatus;
  pid: number | null;
  version: string | null;
  restarts: number;
  lastHeartbeat: number | null;
}

const HEARTBEAT_INTERVAL_MS = 5_000;
const MISSED_DEGRADED = 2;
const MISSED_RESTART = 4;
const BACKOFF_MS = [500, 1000, 2000, 4000, 8000] as const;
const MAX_RESTARTS_PER_10MIN = 5;

export class EngineSupervisor {
  private _client: EngineClient | null = null;
  private _state: SupervisorState = {
    status: "down",
    pid: null,
    version: null,
    restarts: 0,
    lastHeartbeat: null,
  };
  private _missedHeartbeats = 0;
  private _heartbeatTimer: number | null = null;
  private _restartTimestamps: number[] = [];
  private _onOrphanRun?: (runId: string) => Promise<void>;

  constructor(
    private readonly engineBin: string,
    opts?: { onOrphanRun?: (runId: string) => Promise<void> },
  ) {
    this._onOrphanRun = opts?.onOrphanRun;
  }

  get state(): SupervisorState { return { ...this._state }; }
  get client(): EngineClient | null { return this._client; }

  async start(): Promise<void> {
    log.info("Supervisor starting engine", { bin: this.engineBin });
    await this._startEngine();
    this._scheduleHeartbeat();
  }

  private async _startEngine(): Promise<void> {
    this._state.status = "starting";
    try {
      this._client = new EngineClient(this.engineBin);
      const result = await this._client.start();
      if (!result.ok) throw result.error;

      this._state = {
        status: "ok",
        pid: null, // actual pid not exposed via client yet
        version: result.value.version,
        restarts: this._state.restarts,
        lastHeartbeat: Date.now(),
      };
      this._missedHeartbeats = 0;
      log.info("Engine started", { version: result.value.version });
    } catch (e) {
      this._state.status = "down";
      log.error("Engine failed to start", { error: String(e) });
      throw e;
    }
  }

  private _scheduleHeartbeat(): void {
    this._heartbeatTimer = setInterval(async () => {
      await this._heartbeat();
    }, HEARTBEAT_INTERVAL_MS) as unknown as number;
  }

  private async _heartbeat(): Promise<void> {
    if (!this._client) return;
    const result = await this._client.ping();
    if (result.ok) {
      this._missedHeartbeats = 0;
      this._state.status = "ok";
      this._state.lastHeartbeat = Date.now();
    } else {
      this._missedHeartbeats++;
      log.warn("Heartbeat missed", { missed: this._missedHeartbeats });

      if (this._missedHeartbeats >= MISSED_DEGRADED) {
        this._state.status = "degraded";
      }
      if (this._missedHeartbeats >= MISSED_RESTART) {
        await this._restart();
      }
    }
  }

  private async _restart(): Promise<void> {
    const now = Date.now();
    // Trim restart history older than 10 min
    this._restartTimestamps = this._restartTimestamps.filter(t => now - t < 10 * 60_000);

    if (this._restartTimestamps.length >= MAX_RESTARTS_PER_10MIN) {
      log.error("Engine restart limit reached", {
        restarts: this._restartTimestamps.length,
        windowMin: 10,
      });
      this._state.status = "down";
      return;
    }

    const attempt = this._restartTimestamps.length;
    const backoffMs = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
    this._state.restarts++;
    this._restartTimestamps.push(now);

    log.warn("Restarting engine", { attempt, backoffMs });
    await this._client?.stop();

    await new Promise((r) => setTimeout(r, backoffMs));
    try {
      await this._startEngine();
    } catch {
      // Next heartbeat miss will trigger another restart attempt
    }
  }

  async repairOrphanRuns(orphanRunIds: string[]): Promise<void> {
    // Called at boot before accepting traffic — SYS_DESIGN §4.4
    for (const runId of orphanRunIds) {
      log.warn("Repairing orphan run", { runId });
      await this._onOrphanRun?.(runId);
    }
  }

  async stop(): Promise<void> {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    await this._client?.stop();
    this._state.status = "down";
  }
}
