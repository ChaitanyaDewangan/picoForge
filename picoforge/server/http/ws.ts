// server/http/ws.ts — WebSocket hub
// SYS_DESIGN §3.3: one socket per open conversation tab,
// monotonic seq, ring-buffer resume (last 500 events), backpressure.

import { makeLogger } from "../log.ts";
import { ClientEventSchema, ServerEvent, ServerEventSchema } from "../domain/events.ts";
import { getBootToken } from "../config.ts";

const log = makeLogger("ws");

const RING_SIZE = 500;
const QUEUE_WATERMARK = 1024 * 1024; // 1 MiB

// ─── Session ──────────────────────────────────────────────────────────────────

interface Session {
  id: string;
  conversationId: string;
  socket: WebSocket;
  seq: number; // last seq sent to this client
}

// ─── Per-conversation ring buffer + session set ────────────────────────────────

interface ConvState {
  ring: Array<{ seq: number; frame: string; type: string }>; // last RING_SIZE frames
  nextSeq: number;
  sessions: Map<string, Session>;
}

const convMap = new Map<string, ConvState>();

function getOrCreateConv(conversationId: string): ConvState {
  let state = convMap.get(conversationId);
  if (!state) {
    state = { ring: [], nextSeq: 0, sessions: new Map() };
    convMap.set(conversationId, state);
  }
  return state;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Broadcast a typed server event to all sessions for a conversation */
export function broadcast(
  conversationId: string,
  event: Omit<ServerEvent, "seq">,
): void {
  const state = convMap.get(conversationId);
  if (!state) return;
  const seq = state.nextSeq++;
  const frame = JSON.stringify({ ...event, seq });

  // Persist in ring
  state.ring.push({ seq, frame, type: (event as { type: string }).type });
  if (state.ring.length > RING_SIZE) state.ring.shift();

  // Fan-out to connected sessions
  for (const session of state.sessions.values()) {
    sendToSession(session, frame, (event as { type: string }).type);
  }
}

/** Send one event directly to a single session (e.g. hello on connect) */
export function sendToSession(session: Session, frame: string, type: string): void {
  if (session.socket.readyState !== WebSocket.OPEN) return;
  try {
    // Backpressure: drop step.log if queue is too large (SYS_DESIGN §3.3)
    const buffered = (session.socket as unknown as { bufferedAmount?: number })
      .bufferedAmount ?? 0;
    if (buffered > QUEUE_WATERMARK && type === "step.log") return;
    session.socket.send(frame);
  } catch (e) {
    log.warn("WS send failed", { sessionId: session.id, error: String(e) });
  }
}

// ─── Viewport Capture Request/Response ────────────────────────────────────────

const pendingCaptures = new Map<string, (base64: string | null) => void>();

export function requestCapture(
  conversationId: string,
  view: string,
  timeoutMs: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      pendingCaptures.delete(requestId);
      resolve(null);
    }, timeoutMs);

    pendingCaptures.set(requestId, (base64: string | null) => {
      if (timedOut) return;
      clearTimeout(timer);
      pendingCaptures.delete(requestId);
      resolve(base64);
    });

    broadcast(conversationId, {
      type: "viewport.capture.request",
      requestId,
      view,
      width: 1024,
      height: 1024,
    } as Omit<ServerEvent, "seq">);
  });
}

export function resolveCapture(requestId: string, base64png?: string): void {
  const resolver = pendingCaptures.get(requestId);
  if (resolver) {
    resolver(base64png ?? null);
  }
}

// ─── wsHub for tools ──────────────────────────────────────────────────────────

export const wsHub = {
  requestCapture,
  sendToConversation: (id: string, event: unknown) => {
    broadcast(id, event as Omit<ServerEvent, "seq">);
    return Promise.resolve();
  },
};

// ─── Upgrade handler ──────────────────────────────────────────────────────────

/** Handles incoming WebSocket upgrade requests (called from router) */
export function handleWsUpgrade(
  req: Request,
  conversationId: string,
  onClientEvent: (conversationId: string, sessionId: string, event: unknown) => void,
): Response {
  // Verify boot token (SYS_DESIGN §10)
  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  if (token !== getBootToken()) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  const sessionId = crypto.randomUUID();
  const resumeFrom = Number(url.searchParams.get("resume") ?? "0");

  const session: Session = { id: sessionId, conversationId, socket, seq: resumeFrom };

  socket.onopen = () => {
    const state = getOrCreateConv(conversationId);
    state.sessions.set(sessionId, session);
    log.info("WS connected", { sessionId, conversationId });

    // Send hello with resumeFrom position
    const helloSeq = state.nextSeq++;
    const helloFrame = JSON.stringify({
      type: "hello",
      seq: helloSeq,
      sessionId,
      resumeFrom,
    });
    state.ring.push({ seq: helloSeq, frame: helloFrame, type: "hello" });
    if (state.ring.length > RING_SIZE) state.ring.shift();
    sendToSession(session, helloFrame, "hello");

    // Replay missed frames (resume > 0)
    if (resumeFrom > 0) {
      const missed = state.ring.filter((e) => e.seq > resumeFrom && e.seq < helloSeq);
      for (const entry of missed) {
        sendToSession(session, entry.frame, entry.type);
      }
    }
  };

  socket.onmessage = (ev) => {
    try {
      const raw = JSON.parse(ev.data as string);
      const parsed = ClientEventSchema.safeParse(raw);
      if (!parsed.success) {
        log.warn("Invalid client WS event", { sessionId, errors: parsed.error.issues });
        return;
      }
      // Respond to ping inline
      if (parsed.data.type === "ping") {
        const state = convMap.get(conversationId);
        if (state) {
          const pongSeq = state.nextSeq++;
          const pong = JSON.stringify({ type: "pong", seq: pongSeq });
          state.ring.push({ seq: pongSeq, frame: pong, type: "pong" });
          if (state.ring.length > RING_SIZE) state.ring.shift();
          sendToSession(session, pong, "pong");
        }
        return;
      }
      onClientEvent(conversationId, sessionId, parsed.data);
    } catch (e) {
      log.warn("WS message parse error", { sessionId, error: String(e) });
    }
  };

  socket.onclose = () => {
    const state = convMap.get(conversationId);
    state?.sessions.delete(sessionId);
    log.info("WS disconnected", { sessionId, conversationId });
    // Clean up conv state if no sessions left (keep ring for resume)
    // Do NOT delete state — ring must survive for resume
  };

  socket.onerror = (e) => {
    log.warn("WS error", { sessionId, error: String(e) });
  };

  return response;
}

/** Validate that a server event is well-formed (used in tests and before broadcast) */
export function validateServerEvent(event: unknown): ServerEvent {
  return ServerEventSchema.parse(event);
}
