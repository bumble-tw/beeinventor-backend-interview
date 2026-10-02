<!-- SPECTRA:START v1.3.0 -->

# Spectra Instructions

This project uses Spectra for Spec-Driven Development(SDD). Specs live in `docs/spectra/specs/`, change proposals in `docs/spectra/changes/`.

## Skills

Each `/spectra-*` skill carries its own trigger description; these are the groups:

- Shape and plan → `/spectra-discuss`, `/spectra-propose`
- Continue tasks for an identified change → `/spectra-apply`
- Update requirements or plans for an identified change → `/spectra-ingest`
- Quality gate → `/spectra-verify`, `/spectra-review`, `/spectra-analyze`, `/spectra-audit`, `/spectra-drift`, `/spectra-debug`
- Finish → `/spectra-archive`, `/spectra-commit`

Explicit skill invocation takes precedence. Apply existing authorization within its unchanged scope.

## Workflow

discuss? → propose → apply ⇄ ingest → verify / review → archive

- `discuss` is optional — skip if requirements are clear
- Requirements change mid-work? Plan mode → `ingest` → resume `apply`

## Parked Changes

Changes can be parked（暫存）— temporarily moved out of `docs/spectra/changes/`. Parked changes won't appear in `spectra list` but can be found with `spectra list --parked`. To restore: `spectra unpark <name>`. The `/spectra-apply` and `/spectra-ingest` skills disclose parking and restore when the named operation is already explicitly requested; respect a known refusal, otherwise ask for missing authorization.

<!-- SPECTRA:END -->

# Project Tooling

This project is developed with Claude Code plus three tools. Use them as follows.

## codebase-memory-mcp — code exploration

MCP server that keeps a knowledge graph of this repo.

- Use its tools first for code discovery: `search_graph`, `trace_path`, `get_code_snippet`, `get_architecture`, `search_code`, `query_graph`.
- After adding or significantly changing code, re-run `index_repository` (or `detect_changes`) so the graph stays fresh.
- Use Read/Grep freely for Markdown, configs and other non-code files.

## Spectra — spec-driven development

See the Spectra section above. Specs live in `docs/spectra/`; project context for AI is in `docs/spectra/config.yaml`.

- New feature or exercise part → `/spectra-propose` (or `/spectra-discuss` first if unclear), then `/spectra-apply`.
- Finish with `/spectra-verify` → `/spectra-archive` → `/spectra-commit`.

Diagrams for Exercise 2 → use the archify skill; conventions in `exercise-2-system-design/CLAUDE.md`.
