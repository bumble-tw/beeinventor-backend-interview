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

## Commit history

Each exercise part is committed separately so the solving process can be followed:

1. Project setup
2. Exercise 1 — Part A: exact match
3. Exercise 1 — Part B: prefix search
4. Exercise 1 — Part C: wildcard search
5. Exercise 2 — system design
