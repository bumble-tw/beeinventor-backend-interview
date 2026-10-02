# BeeInventor — DasIoT Backend Technical Interview

Language: **TypeScript** (Node.js 24, standard library only at runtime).

| Exercise | Folder | Summary |
|---|---|---|
| 1. In-Memory Dictionary | [`exercise-1-dictionary/`](exercise-1-dictionary/) | Exact match, prefix search, wildcard search (`?`, `*`) |
| 2. Distributed Document Search Platform | [`exercise-2-system-design/`](exercise-2-system-design/) | Architecture, data flow, trade-offs, failure handling |

## How to run

```bash
cd exercise-1-dictionary
npm install        # dev-only: TypeScript + type definitions for type checking
npm test           # runs the test suite with Node's built-in test runner
npm run typecheck  # tsc --noEmit
```

Requires Node.js 24 or later (runs `.ts` files directly via built-in type stripping, no build step).

## AI-assisted workflow

This project is developed with [Claude Code](https://claude.com/claude-code) using spec-driven development, so every change is planned, implemented, and verified against a written spec.

| Tool | Role |
|---|---|
| [Spectra](https://github.com/kaochenlong/spectra-app) | Spec-driven development: each exercise part starts as a change proposal (requirements, design, tasks) before any code is written |
| [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) | Code knowledge graph Claude queries for structure and call chains instead of grepping files |
| [archify](https://github.com/tt-a1i/archify) | Generates the Exercise 2 architecture and sequence diagrams |

Workflow for each exercise part:

1. **Propose:** write the change proposal, spec, and task list (`/spectra-propose`)
2. **Apply:** implement the tasks with tests (`/spectra-apply`)
3. **Verify:** check the code against the spec and tasks (`/spectra-verify`)
4. **Archive:** merge the change into the living specs (`/spectra-archive`)

Where to look:

- [`docs/spectra/specs/`](docs/spectra/specs/): the accepted specs (what the system must do)
- [`docs/spectra/changes/archive/`](docs/spectra/changes/archive/): every completed change with its proposal, design, and tasks, showing how each part was reasoned through
- [`CLAUDE.md`](CLAUDE.md): the instructions Claude follows in this repo

I make the design decisions and review every change; Claude drafts, implements, and checks the work against the spec.

## Commit history

Each exercise part is committed separately so the solving process can be followed:

1. Project setup
2. AI-assisted workflow setup (Spectra, Claude Code)
3. Exercise 1 — Part A: exact match
4. Exercise 1 — Part B: prefix search
5. Exercise 1 — Part C: wildcard search
6. Exercise 2 — system design
