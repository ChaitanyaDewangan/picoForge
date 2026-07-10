// server/harness/tools/index.ts — tool registry
// All 7 tools registered here per LLM_HARNESS §5

export { searchDocsTool }       from "./searchDocs.ts";
export { submitDesignBriefTool } from "./submitDesignBrief.ts";
export { runPicoGKTool }        from "./runPicoGK.ts";
export { inspectGeometryTool }  from "./inspectGeometry.ts";
export { captureViewportTool }  from "./captureViewport.ts";
export { exportArtifactTool }   from "./exportArtifact.ts";
export { askUserTool }          from "./askUser.ts";

import { searchDocsTool }       from "./searchDocs.ts";
import { submitDesignBriefTool } from "./submitDesignBrief.ts";
import { runPicoGKTool }        from "./runPicoGK.ts";
import { inspectGeometryTool }  from "./inspectGeometry.ts";
import { captureViewportTool }  from "./captureViewport.ts";
import { exportArtifactTool }   from "./exportArtifact.ts";
import { askUserTool }          from "./askUser.ts";

export type Tool = typeof searchDocsTool;  // all have the same shape

export const TOOLS = [
  searchDocsTool,
  submitDesignBriefTool,
  runPicoGKTool,
  inspectGeometryTool,
  captureViewportTool,
  exportArtifactTool,
  askUserTool,
] as const;

export const TOOL_MAP = Object.fromEntries(TOOLS.map(t => [t.name, t]));
