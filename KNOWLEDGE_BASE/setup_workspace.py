#!/usr/bin/env python3
"""
setup_workspace.py — bootstrap the PicoForge workspace for the Antigravity IDE.

What it does (each step independent, idempotent, and non-fatal):
  1. Verify prerequisites   (python 3.10+, git; reports deno / dotnet / uv / node / agy)
  2. Create the repo folder tree (matches docs/SYS_DESIGN.md)
  3. Place the spec pack     (*.md next to this script -> docs/, AGENTS.md -> repo root)
  4. Write base files        (.gitignore, .graphifyignore, .env.example, project rule)
  5. Install PONYTAIL        (always-on ruleset -> .agents/rules/  [+ `agy plugin install` if agy exists])
  6. Install GRAPHIFY        (uv/pipx/pip -> `graphify antigravity install` -> git hook)
  7. git init + first commit
  8. Print next steps

Usage:
  python setup_workspace.py [target_dir] [--specs-dir PATH] [--dry-run]
                            [--no-git] [--no-ponytail] [--no-graphify]

Safe to re-run: existing files are never overwritten (skipped and reported).
Stdlib only. Windows / macOS / Linux.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

PONYTAIL_REPO = "https://github.com/DietrichGebert/ponytail"
GRAPHIFY_PYPI = "graphifyy"  # NOTE: package is graphifyy (double y); the CLI command is `graphify`

SPEC_DOCS = [
    "README.md", "SYS_DESIGN.md", "DATA_SCHEMA.md", "LLM_HARNESS.md",
    "PICOGK_KNOWLEDGE.md", "UIUX.md", "RENDERING.md", "USER_FLOWS.md",
]

FOLDERS = [
    "docs",
    ".agents/rules", ".agents/workflows",
    "server/http", "server/db/migrations", "server/db/repo",
    "server/harness/tools", "server/harness/prompts",
    "server/engine", "server/domain", "server/kb",
    "engine/ForgeEngine", "engine/ForgeSandbox/Kit",
    "engine/Kit.Tests", "engine/tools/DumpApi",
    "app/src/state", "app/src/ws", "app/src/chat",
    "app/src/viewport/hud", "app/src/panels", "app/src/styles",
    "scripts", ".tools",
]

GITIGNORE = """\
# --- runtime & secrets ---
.env
secret.env
*.log

# --- js/deno ---
node_modules/
dist/
app/dist/
server/public/
coverage/

# --- dotnet ---
bin/
obj/
*.user

# --- graphify (commit the graph, not local cost data) ---
graphify-out/cost.json

# --- local tool checkouts ---
.tools/
"""

GRAPHIFYIGNORE = """\
# keep the knowledge graph focused on source + specs
graphify-out/
.tools/
node_modules/
dist/
bin/
obj/
coverage/
*.stl
*.glb
*.vdb
"""

ENV_EXAMPLE = """\
# Copy to .env (never commit .env). See docs/SYS_DESIGN.md §3.4.
ANTHROPIC_API_KEY=
"""

PROJECT_RULE = """\
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
"""

# ----------------------------------------------------------------------------- plumbing

@dataclass
class Step:
    name: str
    status: str  # OK | SKIP | FAIL | WARN
    detail: str = ""

@dataclass
class Ctx:
    root: Path
    specs: Path
    dry: bool
    steps: list[Step] = field(default_factory=list)

    def log(self, name: str, status: str, detail: str = "") -> None:
        self.steps.append(Step(name, status, detail))
        pad = {"OK": "  OK ", "SKIP": " SKIP", "FAIL": " FAIL", "WARN": " WARN"}[status]
        print(f"[{pad}] {name}" + (f" — {detail}" if detail else ""))

def run(cmd: list[str], cwd: Path | None = None, timeout: int = 600) -> tuple[int, str]:
    """Run a command; never raises. Returns (exitcode, combined tail output)."""
    try:
        p = subprocess.run(cmd, cwd=str(cwd) if cwd else None, timeout=timeout,
                           capture_output=True, text=True)
        out = ((p.stdout or "") + (p.stderr or "")).strip()
        return p.returncode, out[-800:]
    except FileNotFoundError:
        return 127, f"not found: {cmd[0]}"
    except subprocess.TimeoutExpired:
        return 124, f"timeout after {timeout}s: {' '.join(cmd)}"
    except Exception as e:  # noqa: BLE001 — bootstrap must never crash
        return 1, f"{type(e).__name__}: {e}"

def have(tool: str) -> bool:
    return shutil.which(tool) is not None

def write(ctx: Ctx, rel: str, content: str) -> None:
    path = ctx.root / rel
    if path.exists():
        ctx.log(f"write {rel}", "SKIP", "exists")
        return
    if ctx.dry:
        ctx.log(f"write {rel}", "OK", "dry-run")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")
    ctx.log(f"write {rel}", "OK")

# ----------------------------------------------------------------------------- steps

def step_prereqs(ctx: Ctx) -> None:
    if sys.version_info < (3, 10):
        ctx.log("python >= 3.10", "FAIL", f"found {sys.version.split()[0]}")
    else:
        ctx.log("python >= 3.10", "OK", sys.version.split()[0])
    for tool, required in [("git", True), ("deno", False), ("dotnet", False),
                           ("uv", False), ("pipx", False), ("node", False), ("agy", False)]:
        if have(tool):
            ctx.log(f"tool: {tool}", "OK")
        else:
            ctx.log(f"tool: {tool}", "FAIL" if required else "WARN",
                    "required" if required else "optional — see next steps")

def step_folders(ctx: Ctx) -> None:
    for rel in FOLDERS:
        path = ctx.root / rel
        if path.exists():
            ctx.log(f"mkdir {rel}", "SKIP", "exists")
            continue
        if not ctx.dry:
            path.mkdir(parents=True, exist_ok=True)
            (path / ".gitkeep").touch()
        ctx.log(f"mkdir {rel}", "OK")

def step_specs(ctx: Ctx) -> None:
    agents_src = ctx.specs / "AGENTS.md"
    if agents_src.exists():
        dst = ctx.root / "AGENTS.md"
        if dst.exists():
            ctx.log("place AGENTS.md", "SKIP", "exists")
        elif not ctx.dry:
            shutil.copy2(agents_src, dst)
            ctx.log("place AGENTS.md", "OK", "repo root")
        else:
            ctx.log("place AGENTS.md", "OK", "dry-run")
    else:
        ctx.log("place AGENTS.md", "FAIL", f"not found in {ctx.specs}")

    for name in SPEC_DOCS:
        src = ctx.specs / name
        dst = ctx.root / "docs" / name
        if not src.exists():
            ctx.log(f"place docs/{name}", "FAIL", f"not found in {ctx.specs}")
            continue
        if dst.exists():
            ctx.log(f"place docs/{name}", "SKIP", "exists")
            continue
        if not ctx.dry:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
        ctx.log(f"place docs/{name}", "OK")

def step_base_files(ctx: Ctx) -> None:
    write(ctx, ".gitignore", GITIGNORE)
    write(ctx, ".graphifyignore", GRAPHIFYIGNORE)
    write(ctx, ".env.example", ENV_EXAMPLE)
    write(ctx, ".agents/rules/00-picoforge.md", PROJECT_RULE)

def step_ponytail(ctx: Ctx) -> None:
    """Always-on ruleset into .agents/rules/ (Antigravity reads it every session).
    Strategy: shallow-clone, then copy the first ruleset file found among known
    adapter locations — robust to upstream renames. Plugin install via `agy`
    is attempted as a bonus (adds /ponytail-* skills) but is not required."""
    rules_dst = ctx.root / ".agents" / "rules"
    already = list(rules_dst.glob("*ponytail*")) if rules_dst.exists() else []
    if already:
        ctx.log("ponytail ruleset", "SKIP", f"exists: {already[0].name}")
    else:
        clone = ctx.root / ".tools" / "ponytail"
        if not clone.exists():
            if ctx.dry:
                ctx.log("clone ponytail", "OK", "dry-run")
            else:
                code, out = run(["git", "clone", "--depth", "1", PONYTAIL_REPO, str(clone)])
                ctx.log("clone ponytail", "OK" if code == 0 else "FAIL", out if code else "")
        if clone.exists() or ctx.dry:
            candidates: list[Path] = []
            if clone.exists():
                candidates += sorted((clone / ".agents").rglob("*.md"))
                candidates += sorted((clone / ".kiro" / "steering").glob("*.md"))
                candidates += sorted((clone / ".cursor" / "rules").glob("*"))
                root_agents = clone / "AGENTS.md"
                if root_agents.exists():
                    candidates.append(root_agents)
            src = next((c for c in candidates if c.is_file()), None)
            if ctx.dry:
                ctx.log("ponytail ruleset", "OK", "dry-run")
            elif src is None:
                ctx.log("ponytail ruleset", "FAIL", "no ruleset file found in clone")
            else:
                rules_dst.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, rules_dst / "ponytail.md")
                ctx.log("ponytail ruleset", "OK", f"from {src.relative_to(clone)}")

    if have("agy") and not ctx.dry:
        code, out = run(["agy", "plugin", "install", PONYTAIL_REPO], cwd=ctx.root)
        ctx.log("agy plugin install ponytail", "OK" if code == 0 else "WARN",
                "" if code == 0 else out)
    else:
        ctx.log("agy plugin install ponytail", "SKIP",
                "agy not on PATH — ruleset copy above is sufficient (always-on)")

def step_graphify(ctx: Ctx) -> None:
    """Install the graphifyy package, then wire Antigravity + the git hook."""
    if not have("graphify"):
        if ctx.dry:
            ctx.log("install graphifyy", "OK", "dry-run")
        elif have("uv"):
            code, out = run(["uv", "tool", "install", GRAPHIFY_PYPI])
            ctx.log("uv tool install graphifyy", "OK" if code == 0 else "FAIL", out if code else "")
        elif have("pipx"):
            code, out = run(["pipx", "install", GRAPHIFY_PYPI])
            ctx.log("pipx install graphifyy", "OK" if code == 0 else "FAIL", out if code else "")
        else:
            code, out = run([sys.executable, "-m", "pip", "install", "--user", GRAPHIFY_PYPI])
            ctx.log("pip install --user graphifyy", "OK" if code == 0 else "FAIL",
                    out if code else "PATH note: may need ~/.local/bin on PATH")
    else:
        ctx.log("install graphifyy", "SKIP", "graphify already on PATH")

    if ctx.dry:
        ctx.log("graphify antigravity install", "OK", "dry-run")
        return
    if not have("graphify"):
        ctx.log("graphify antigravity install", "FAIL",
                "graphify not on PATH — run `uv tool update-shell` / `pipx ensurepath`, "
                "open a new terminal, then: graphify antigravity install")
        return
    code, out = run(["graphify", "antigravity", "install"], cwd=ctx.root)
    ctx.log("graphify antigravity install", "OK" if code == 0 else "WARN",
            ".agents/rules + .agents/workflows" if code == 0 else out)

def step_git(ctx: Ctx, do_graphify_hook: bool) -> None:
    if not have("git"):
        ctx.log("git init", "FAIL", "git not installed")
        return
    if (ctx.root / ".git").exists():
        ctx.log("git init", "SKIP", "repo exists")
    elif ctx.dry:
        ctx.log("git init", "OK", "dry-run")
    else:
        code, out = run(["git", "init", "-b", "main"], cwd=ctx.root)
        ctx.log("git init", "OK" if code == 0 else "FAIL", out if code else "")

    if do_graphify_hook and have("graphify") and (ctx.root / ".git").exists() and not ctx.dry:
        code, out = run(["graphify", "hook", "install"], cwd=ctx.root)
        ctx.log("graphify hook install", "OK" if code == 0 else "WARN",
                "auto-rebuild graph on commit" if code == 0 else out)

    if (ctx.root / ".git").exists() and not ctx.dry:
        run(["git", "add", "-A"], cwd=ctx.root)
        code, out = run(["git", "commit", "-m",
                         "chore: PicoForge workspace scaffold (specs + ponytail + graphify)"],
                        cwd=ctx.root)
        ctx.log("git commit", "OK" if code == 0 else "SKIP",
                "" if code == 0 else "nothing to commit or identity unset")

# ----------------------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("target", nargs="?", default="picoforge", help="workspace directory")
    ap.add_argument("--specs-dir", default=None,
                    help="where the spec-pack .md files live (default: this script's folder)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-git", action="store_true")
    ap.add_argument("--no-ponytail", action="store_true")
    ap.add_argument("--no-graphify", action="store_true")
    args = ap.parse_args()

    here = Path(__file__).resolve().parent
    ctx = Ctx(root=Path(args.target).resolve(),
              specs=Path(args.specs_dir).resolve() if args.specs_dir else here,
              dry=args.dry_run)

    print(f"\nPicoForge workspace setup -> {ctx.root}\nspec pack source          -> {ctx.specs}\n")
    if not ctx.dry:
        ctx.root.mkdir(parents=True, exist_ok=True)

    step_prereqs(ctx)
    step_folders(ctx)
    step_specs(ctx)
    step_base_files(ctx)
    if not args.no_ponytail:
        step_ponytail(ctx)
    if not args.no_graphify:
        step_graphify(ctx)
    if not args.no_git:
        step_git(ctx, do_graphify_hook=not args.no_graphify)

    fails = [s for s in ctx.steps if s.status == "FAIL"]
    warns = [s for s in ctx.steps if s.status == "WARN"]
    print(f"\n{'-'*72}\nSummary: {sum(s.status=='OK' for s in ctx.steps)} ok · "
          f"{sum(s.status=='SKIP' for s in ctx.steps)} skipped · "
          f"{len(warns)} warnings · {len(fails)} failed")
    for s in fails:
        print(f"  FAIL  {s.name}: {s.detail}")

    print(f"""
Next steps
  1. cd {ctx.root}
  2. cp .env.example .env      # add your ANTHROPIC_API_KEY
  3. Open the folder in Antigravity IDE.
  4. In the agent chat, build the knowledge graph:   /graphify .
  5. Kick off the build:  "Read AGENTS.md and execute Milestone M0."
  (Missing deno/dotnet? Install Deno >= 2.2 and .NET 9 SDK before M0's gate.)
""")
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(main())
