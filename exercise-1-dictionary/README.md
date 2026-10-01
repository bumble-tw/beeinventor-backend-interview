# Exercise 1 — In-Memory Dictionary

## API

```ts
setup(words: string[]): void        // load or replace the dictionary contents
contains(word: string): boolean     // Part A — exact match
startsWith(prefix: string): boolean // Part B — prefix search
search(pattern: string): boolean    // Part C — wildcard search (`?` = one char, `*` = zero or more)
```

## Assumptions

- Words contain lowercase English letters `a-z`.
- Duplicate words do not change the result.
- Calling `setup` again replaces the previous contents.
- TODO: empty string / empty dictionary / invalid characters

## Data structure choice

TODO: what was chosen, alternatives considered, and why.

## Complexity

| Operation | Time | Space |
|---|---|---|
| `setup` | TODO | TODO |
| `contains` | TODO | TODO |
| `startsWith` | TODO | TODO |
| `search` | TODO | TODO |

## Trade-offs

TODO

## Tests

```bash
npm test
```

TODO: list of covered cases (examples from the spec, edge cases).
