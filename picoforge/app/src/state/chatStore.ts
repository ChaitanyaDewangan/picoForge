// app/src/state/chatStore.ts — Chat state store
// Drives MessageList, BuildCard, ConsoleDrawer from WS events.
// Ponytail: plain Map + useReducer — no external state library needed.

import { useReducer, useEffect, useRef, useCallback } from "react";
import { WsClient, WsEvent } from "../ws/client.ts";

// ─── Domain types ─────────────────────────────────────────────────────────────

export type RunState =
  | "queued"
  | "briefing"
  | "codegen"
  | "compiling"
  | "executing"
  | "validating"
  | "rendering"
  | "done"
  | "failed"
  | "cancelled";

export interface RunStep {
  stepId: string;
  tool: string;
  title: string;
  logs: string[];
  ok: boolean | null;
  summaryJson: unknown;
}

export interface RunInfo {
  runId: string;
  state: RunState;
  attempt: number;
  stage?: string;
  steps: RunStep[];
}

export interface GeometryInfo {
  artifactId: string;
  url: string;
  format: "glb" | "stl";
  stats: {
    volumeCm3: number;
    bbox: { min: [number, number, number]; max: [number, number, number] };
    triangles: number;
    watertight: boolean;
    voxelSizeMm: number;
  };
}

// Content blocks — mirrors server/db/repo/messages.ts ContentBlock
export type MsgBlock =
  | { t: "text"; text: string }
  | { t: "brief"; brief: unknown }
  | { t: "build"; runId: string }
  | { t: "geometry"; artifactId: string }
  | { t: "error"; code: string; msg: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  blocks: MsgBlock[];
  createdAt: number;
  /** For streaming assistant messages: accumulated text before a block is finalized */
  streamingText?: string;
  askUserOptions?: string[];
}

// ─── Store state ──────────────────────────────────────────────────────────────

export interface ChatState {
  messages: ChatMessage[];
  runs: Map<string, RunInfo>;
  geometry: Map<string, GeometryInfo>; // keyed by runId
  consoleLogs: { area: "build" | "engine" | "events"; line: string; ts: number }[];
  connected: boolean;
  pendingQueue: number; // messages queued while a run is active
  /** Most recently built geometry — forwarded to the viewport */
  lastArtifact: { url: string; format: "glb" | "stl"; stats: GeometryInfo["stats"] } | null;
}

const INITIAL: ChatState = {
  messages: [],
  runs: new Map(),
  geometry: new Map(),
  consoleLogs: [],
  connected: false,
  pendingQueue: 0,
  lastArtifact: null,
};

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "CONNECTED"; connected: boolean }
  | { type: "HYDRATE"; messages: ChatMessage[] }
  | { type: "CHAT_DELTA"; messageId: string; textDelta: string }
  | { type: "CHAT_BLOCK"; messageId: string; block: MsgBlock }
  | { type: "CHAT_DONE"; messageId: string; usage: { inputTokens: number; outputTokens: number } }
  | { type: "RUN_STATUS"; runId: string; state: RunState; attempt: number; stage?: string }
  | { type: "STEP_START"; runId: string; stepId: string; tool: string; title: string }
  | { type: "STEP_LOG"; runId: string; stepId: string; line: string }
  | { type: "STEP_DONE"; runId: string; stepId: string; ok: boolean; summaryJson: unknown }
  | { type: "GEOMETRY_READY"; runId: string; info: GeometryInfo }
  | { type: "USER_SEND"; text: string; messageId: string }
  | { type: "MESSAGE_CREATED"; message: { id: string; role: string; content: string; createdAt: number } }
  | { type: "ASK_USER"; runId: string; question: string; options: string[] }
  | { type: "ASSISTANT_PLACEHOLDER"; messageId: string };

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case "CONNECTED":
      return { ...state, connected: action.connected };

    case "HYDRATE":
      return { ...state, messages: action.messages };

    case "USER_SEND": {
      const msg: ChatMessage = {
        id: action.messageId,
        role: "user",
        blocks: [{ t: "text", text: action.text }],
        createdAt: Date.now(),
      };
      return { ...state, messages: [...state.messages, msg] };
    }

    case "MESSAGE_CREATED": {
      // Prevent duplicating USER_SEND message
      if (state.messages.some((m) => m.id === action.message.id)) return state;
      const msg: ChatMessage = {
        id: action.message.id,
        role: action.message.role as "user" | "assistant",
        blocks: action.message.content ? [{ t: "text", text: action.message.content }] : [],
        createdAt: action.message.createdAt,
      };
      return { ...state, messages: [...state.messages, msg] };
    }

    case "ASK_USER": {
      // Create a special message for the ask_user fork
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        blocks: [{ t: "text", text: action.question }],
        createdAt: Date.now(),
        askUserOptions: action.options,
      };
      return { ...state, messages: [...state.messages, msg] };
    }

    case "ASSISTANT_PLACEHOLDER": {
      const msg: ChatMessage = {
        id: action.messageId,
        role: "assistant",
        blocks: [],
        createdAt: Date.now(),
        streamingText: "",
      };
      return { ...state, messages: [...state.messages, msg] };
    }

    case "CHAT_DELTA": {
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.messageId
            ? { ...m, streamingText: (m.streamingText ?? "") + action.textDelta }
            : m,
        ),
      };
    }

    case "CHAT_BLOCK": {
      return {
        ...state,
        messages: state.messages.map((m) => {
          if (m.id !== action.messageId) return m;
          // Flush streaming text as a text block if any
          const newBlocks: MsgBlock[] = m.streamingText
            ? [...m.blocks, { t: "text", text: m.streamingText }, action.block]
            : [...m.blocks, action.block];
          return { ...m, blocks: newBlocks, streamingText: "" };
        }),
      };
    }

    case "CHAT_DONE": {
      return {
        ...state,
        messages: state.messages.map((m) => {
          if (m.id !== action.messageId) return m;
          const newBlocks: MsgBlock[] = m.streamingText
            ? [...m.blocks, { t: "text", text: m.streamingText }]
            : m.blocks;
          return { ...m, blocks: newBlocks, streamingText: undefined };
        }),
      };
    }

    case "RUN_STATUS": {
      const existing = state.runs.get(action.runId);
      const updated = new Map(state.runs);
      updated.set(action.runId, {
        runId: action.runId,
        state: action.state,
        attempt: action.attempt,
        stage: action.stage,
        steps: existing?.steps ?? [],
      });
      return { ...state, runs: updated };
    }

    case "STEP_START": {
      const run = state.runs.get(action.runId);
      if (!run) return state;
      const updated = new Map(state.runs);
      updated.set(action.runId, {
        ...run,
        steps: [
          ...run.steps,
          { stepId: action.stepId, tool: action.tool, title: action.title, logs: [], ok: null, summaryJson: null },
        ],
      });
      return { ...state, runs: updated };
    }

    case "STEP_LOG": {
      const run = state.runs.get(action.runId);
      if (!run) return state;
      const updated = new Map(state.runs);
      updated.set(action.runId, {
        ...run,
        steps: run.steps.map((s) =>
          s.stepId === action.stepId ? { ...s, logs: [...s.logs, action.line] } : s,
        ),
      });
      // Also push to console logs
      const consoleLogs = [
        ...state.consoleLogs,
        { area: "build" as const, line: action.line, ts: Date.now() },
      ].slice(-2000); // cap at 2000 lines
      return { ...state, runs: updated, consoleLogs };
    }

    case "STEP_DONE": {
      const run = state.runs.get(action.runId);
      if (!run) return state;
      const updated = new Map(state.runs);
      updated.set(action.runId, {
        ...run,
        steps: run.steps.map((s) =>
          s.stepId === action.stepId ? { ...s, ok: action.ok, summaryJson: action.summaryJson } : s,
        ),
      });
      return { ...state, runs: updated };
    }

    case "GEOMETRY_READY": {
      const geo = new Map(state.geometry);
      geo.set(action.runId, action.info);
      return {
        ...state,
        geometry: geo,
        lastArtifact: {
          url: action.info.url,
          format: action.info.format,
          stats: action.info.stats,
        },
      };
    }

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChatStore(conversationId: string) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const wsRef = useRef<WsClient | null>(null);

  useEffect(() => {
    const ws = new WsClient(conversationId);
    wsRef.current = ws;

    // Status handler
    const offStatus = ws.onStatus((connected) => {
      dispatch({ type: "CONNECTED", connected });
    });

    // Event handler — map WS events to actions
    const offEvent = ws.on((event: WsEvent) => {
      switch (event.type) {
        case "chat.delta":
          dispatch({
            type: "CHAT_DELTA",
            messageId: event.messageId as string,
            textDelta: event.textDelta as string,
          });
          break;
        case "chat.block":
          dispatch({
            type: "CHAT_BLOCK",
            messageId: event.messageId as string,
            block: event.block as MsgBlock,
          });
          break;
        case "chat.done":
          dispatch({
            type: "CHAT_DONE",
            messageId: event.messageId as string,
            usage: event.usage as { inputTokens: number; outputTokens: number },
          });
          break;
        case "run.status":
          dispatch({
            type: "RUN_STATUS",
            runId: event.runId as string,
            state: event.state as RunState,
            attempt: event.attempt as number,
            stage: event.stage as string | undefined,
          });
          break;
        case "step.start":
          dispatch({
            type: "STEP_START",
            runId: event.runId as string,
            stepId: event.stepId as string,
            tool: event.tool as string,
            title: event.title as string,
          });
          break;
        case "step.log":
          dispatch({
            type: "STEP_LOG",
            runId: event.runId as string,
            stepId: event.stepId as string,
            line: event.line as string,
          });
          break;
        case "step.done":
          dispatch({
            type: "STEP_DONE",
            runId: event.runId as string,
            stepId: event.stepId as string,
            ok: event.ok as boolean,
            summaryJson: event.summaryJson,
          });
          break;
        case "geometry.ready":
          dispatch({
            type: "GEOMETRY_READY",
            runId: event.runId as string,
            info: event.info as GeometryInfo,
          });
          break;
        case "message.created":
          dispatch({
            type: "MESSAGE_CREATED",
            message: event.message as any,
          });
          break;
        case "ask_user":
          dispatch({
            type: "ASK_USER",
            runId: event.runId as string,
            question: event.question as string,
            options: event.options as string[],
          });
          break;
        case "viewport.capture.request": {
          // Dispatch a custom DOM event for the ViewportPane to intercept
          const evt = new CustomEvent("picoforge.viewport.capture", {
            detail: {
              requestId: event.requestId,
              view: event.view,
              ws: wsRef.current,
            },
          });
          window.dispatchEvent(evt);
          break;
        }
        default:
          break;
      }
    });

    ws.connect();

    return () => {
      offStatus();
      offEvent();
      ws.destroy();
    };
  }, [conversationId]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const messageId = crypto.randomUUID();
      dispatch({ type: "USER_SEND", text, messageId });
      wsRef.current?.send({ type: "user.message", text });
    },
    [],
  );

  const cancelRun = useCallback((runId: string) => {
    wsRef.current?.send({ type: "run.cancel", runId });
  }, []);

  return { state, sendMessage, cancelRun };
}
