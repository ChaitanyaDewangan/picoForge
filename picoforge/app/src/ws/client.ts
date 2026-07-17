// app/src/ws/client.ts — WebSocket client
// SYS_DESIGN §3.3: reconnect with ?resume=<seq>, typed events
// Ponytail: AbortController for teardown, Map for pending, no framework

export type ServerEventType =
  | "hello"
  | "chat.delta"
  | "chat.block"
  | "chat.done"
  | "run.status"
  | "step.start"
  | "step.log"
  | "step.done"
  | "geometry.ready"
  | "viewport.capture.request"
  | "ask_user"
  | "message.created"
  | "error"
  | "pong";

// Raw server event (discriminated by type)
export interface WsEvent {
  type: ServerEventType;
  seq: number;
  [key: string]: unknown;
}

export type WsEventHandler = (event: WsEvent) => void;
export type WsStatusHandler = (connected: boolean) => void;

const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000];
const PING_INTERVAL_MS = 25_000;

export class WsClient {
  private _ws: WebSocket | null = null;
  private _lastSeq = 0;
  private _reconnectAttempt = 0;
  private _pingTimer: ReturnType<typeof setInterval> | null = null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _destroyed = false;

  private readonly _handlers: WsEventHandler[] = [];
  private readonly _statusHandlers: WsStatusHandler[] = [];

  constructor(
    private readonly conversationId: string,
    private readonly baseUrl = `ws://${location.host}`,
  ) {}

  /** Start connection */
  connect(): void {
    if (this._destroyed) return;
    this._openSocket();
  }

  /** Send a typed client event */
  send(event: Record<string, unknown>): void {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(event));
    }
  }

  on(handler: WsEventHandler): () => void {
    this._handlers.push(handler);
    return () => {
      const i = this._handlers.indexOf(handler);
      if (i !== -1) this._handlers.splice(i, 1);
    };
  }

  onStatus(handler: WsStatusHandler): () => void {
    this._statusHandlers.push(handler);
    return () => {
      const i = this._statusHandlers.indexOf(handler);
      if (i !== -1) this._statusHandlers.splice(i, 1);
    };
  }

  destroy(): void {
    this._destroyed = true;
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this._pingTimer) clearInterval(this._pingTimer);
    this._ws?.close();
    this._ws = null;
  }

  private _openSocket(): void {
    const url = `${this.baseUrl}/ws?conversationId=${this.conversationId}&resume=${this._lastSeq}`;
    const ws = new WebSocket(url);
    this._ws = ws;

    ws.onopen = () => {
      this._reconnectAttempt = 0;
      this._emit(true);
      this._startPing();
    };

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const event = JSON.parse(ev.data as string) as WsEvent;
        if (typeof event.seq === "number") this._lastSeq = event.seq;
        for (const h of this._handlers) h(event);
      } catch {
        /* skip malformed */
      }
    };

    ws.onclose = () => {
      this._stopPing();
      this._emit(false);
      if (!this._destroyed) this._scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  private _startPing(): void {
    this._stopPing();
    this._pingTimer = setInterval(() => {
      this.send({ type: "ping" });
    }, PING_INTERVAL_MS);
  }

  private _stopPing(): void {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  private _scheduleReconnect(): void {
    const delay = RECONNECT_DELAYS_MS[Math.min(this._reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this._reconnectAttempt++;
    this._reconnectTimer = setTimeout(() => {
      if (!this._destroyed) this._openSocket();
    }, delay);
  }

  private _emit(connected: boolean): void {
    for (const h of this._statusHandlers) h(connected);
  }
}
