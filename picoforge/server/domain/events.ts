// server/domain/events.ts — Single source of truth for all WS event schemas
// All WS frames validated here on BOTH sides (SYS_DESIGN §3.3)

import { z } from "zod";

// ─── Client → Server ──────────────────────────────────────────────────────────

export const UserMessageEvent = z.object({
  type: z.literal("user.message"),
  text: z.string().min(1).max(32_000),
  attachments: z.array(z.object({ artifactId: z.string() })).optional(),
});

export const RunCancelEvent = z.object({
  type: z.literal("run.cancel"),
  runId: z.string(),
});

export const ViewportCaptureResultEvent = z.object({
  type: z.literal("viewport.capture.result"),
  requestId: z.string(),
  pngBase64: z.string().optional(),
  error: z.string().optional(),
});

export const PingEvent = z.object({
  type: z.literal("ping"),
});

export const ClientEventSchema = z.discriminatedUnion("type", [
  UserMessageEvent,
  RunCancelEvent,
  ViewportCaptureResultEvent,
  PingEvent,
]);

export type ClientEvent = z.infer<typeof ClientEventSchema>;

// ─── Server → Client ──────────────────────────────────────────────────────────

/** Base: every server frame has a monotonic seq */
const withSeq = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ seq: z.number().int().nonnegative(), ...shape });

export const HelloEvent = withSeq({
  type: z.literal("hello"),
  sessionId: z.string(),
  resumeFrom: z.number().int().nonnegative(),
});

export const ChatDeltaEvent = withSeq({
  type: z.literal("chat.delta"),
  messageId: z.string(),
  textDelta: z.string(),
});

export const ChatBlockEvent = withSeq({
  type: z.literal("chat.block"),
  messageId: z.string(),
  block: z.unknown(), // typed per block kind: brief | note
});

export const ChatDoneEvent = withSeq({
  type: z.literal("chat.done"),
  messageId: z.string(),
  usage: z.object({ inputTokens: z.number(), outputTokens: z.number() }),
});

export const RunState = z.enum([
  "queued",
  "understanding",
  "briefing",
  "building",
  "inspecting",
  "awaiting_user",
  "codegen",
  "compiling",
  "executing",
  "validating",
  "rendering",
  "done",
  "failed",
  "cancelled",
]);
export type RunState = z.infer<typeof RunState>;

export const RunStatusEvent = withSeq({
  type: z.literal("run.status"),
  runId: z.string(),
  state: RunState,
  attempt: z.number().int().nonnegative(),
  stage: z.string().optional(),
});

export const StepStartEvent = withSeq({
  type: z.literal("step.start"),
  runId: z.string(),
  stepId: z.string(),
  tool: z.string(),
  title: z.string(),
});

export const StepLogEvent = withSeq({
  type: z.literal("step.log"),
  runId: z.string(),
  stepId: z.string(),
  line: z.string(),
});

export const StepDoneEvent = withSeq({
  type: z.literal("step.done"),
  runId: z.string(),
  stepId: z.string(),
  ok: z.boolean(),
  summaryJson: z.unknown().optional(),
});

export const GeometryStats = z.object({
  volumeCm3: z.number(),
  bbox: z.object({
    min: z.tuple([z.number(), z.number(), z.number()]),
    max: z.tuple([z.number(), z.number(), z.number()]),
  }),
  triangles: z.number().int(),
  watertight: z.boolean(),
  voxelSizeMm: z.number(),
});
export type GeometryStats = z.infer<typeof GeometryStats>;

export const GeometryReadyEvent = withSeq({
  type: z.literal("geometry.ready"),
  runId: z.string(),
  artifactId: z.string(),
  url: z.string(),
  format: z.enum(["glb", "stl"]),
  stats: GeometryStats,
});

export const ViewportCaptureRequestEvent = withSeq({
  type: z.literal("viewport.capture.request"),
  requestId: z.string(),
  view: z.enum(["iso", "front", "top", "right", "current"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const ErrorEvent = withSeq({
  type: z.literal("error"),
  errId: z.string(),
  code: z.string(),
  message: z.string(),
  recoverable: z.boolean(),
});

export const PongEvent = withSeq({
  type: z.literal("pong"),
});

export const AskUserEvent = withSeq({
  type: z.literal("ask_user"),
  runId: z.string(),
  question: z.string(),
  options: z.array(z.string()),
});

export const MessageCreatedEvent = withSeq({
  type: z.literal("message.created"),
  message: z.object({
    id: z.string(),
    role: z.string(),
    content: z.string(),
    createdAt: z.number(),
  }),
});

export const ServerEventSchema = z.discriminatedUnion("type", [
  HelloEvent,
  MessageCreatedEvent,
  ChatDeltaEvent,
  ChatBlockEvent,
  ChatDoneEvent,
  RunStatusEvent,
  StepStartEvent,
  StepLogEvent,
  StepDoneEvent,
  GeometryReadyEvent,
  ViewportCaptureRequestEvent,
  AskUserEvent,
  ErrorEvent,
  PongEvent,
]);

export type ServerEvent = z.infer<typeof ServerEventSchema>;
