# PicoForge — project rule (always on)

- Standing orders live in /AGENTS.md — read it before any task; it wins on conflict.
- The normative spec pack is in /docs (SYS_DESIGN, LLM_HARNESS, DATA_SCHEMA, UIUX,
  RENDERING, PICOGK_KNOWLEDGE, USER_FLOWS). Do not invent architecture the pack
  already decides; read the referenced section before implementing.
- Build strictly in milestone order M0 -> M8 (AGENTS.md §4). A failed gate blocks
  the next milestone.
- Ponytail is active at `full`: minimal-code ladder governs HOW each spec'd unit
  is written, never WHETHER it exists (AGENTS.md §1 precedence rule).
- Graph-first navigation: `graphify query/path/explain` before grepping or
  opening files broadly (AGENTS.md §2).
