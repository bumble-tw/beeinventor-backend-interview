# Exercise 1 — In-Memory Dictionary

## Try it

Start an interactive session and type commands directly — no code or imports needed:

```bash
npm run demo
```

```text
> setup cat car card
Loaded 3 word(s).
> contains cat
true
> contains ca
false
> setup Dog
Error: Invalid word "Dog": only lowercase a-z is allowed
> contains car
true
> exit
```

| Command | What it does |
|---|---|
| `setup <word> <word> ...` | Load these words, replacing the dictionary (`setup` alone empties it) |
| `contains <word>` | Print `true` if the word was loaded, otherwise `false` |
| `help` | Show the command list |
| `exit` / `quit` / Ctrl+D | End the session |

Type `""` for the empty string, which is never a word: `setup ""` is rejected and `contains ""` prints `false`. Commands can also be piped in: `printf 'setup cat\ncontains cat\n' | npm run demo`.

## API

Create a dictionary with `createDictionary()`, then call its methods:

```ts
import { createDictionary } from "./src/dictionary.ts";

const dict = createDictionary();
dict.setup(["cat", "car", "card"]);
dict.contains("cat"); // true
dict.contains("ca");  // false
```

Each `createDictionary()` call returns an independent dictionary with these methods:

```ts
setup(words: string[]): void        // load or replace the dictionary contents
contains(word: string): boolean     // Part A — exact match
startsWith(prefix: string): boolean // Part B — prefix search (planned, not implemented yet)
search(pattern: string): boolean    // Part C — wildcard search (`?` = one char, `*` = zero or more) (planned, not implemented yet)
```

## Assumptions

- Words contain lowercase English letters `a-z`.
- Duplicate words do not change the result.
- Calling `setup` again replaces the previous contents.
- The empty string `""` is never a word: `setup` rejects it with a `TypeError` (`Invalid word "": empty words are not allowed`), and `contains("")` is always `false`.
- An empty dictionary (freshly created, or after `setup([])`) returns `false` for every query.
- `setup` throws a `TypeError` (naming the offending word) if any word contains a character outside `a-z`; the dictionary keeps the contents it had before that call.
- `contains` never throws: a query containing a character outside `a-z` simply returns `false`.

## Data structure choice

A **Trie** (prefix tree). Each node holds a `Map<string, TrieNode>` of children and an `isEnd` flag marking the end of a loaded word. `contains` walks the trie one character at a time and returns the `isEnd` flag of the node it lands on, so prefixes of loaded words are not false positives.

`setup` validates every word first, builds a brand-new trie, and only then swaps it in — so a failed `setup` never leaves half-loaded contents. Traversal is iterative (no recursion), so very long words cannot overflow the stack.

The API is a **factory function**: `createDictionary()` keeps the trie root in a local variable that only the returned `setup` / `contains` methods can reach (a closure), so callers cannot touch the internals and every dictionary is independent. Plain module-level `setup` / `contains` functions were rejected because they would share one global dictionary across the whole program — tests would leak state into each other and two dictionaries could not coexist.

Alternatives considered:

- **`Set<string>`** — simplest, and `contains` is also O(L) (hashing reads the whole string). Rejected because Part B (prefix) would need a full scan or a second index, and Part C (wildcard) could not prune the search.
- **`Set` + Trie together** — slightly faster exact match, but doubles memory and keeps two copies in sync; not worth it here.
- **26-slot array per node** (indexed by `charCode - 97`) — marginally faster lookup, but every node allocates 26 slots even when sparse. A `Map` stores only existing branches, reads more clearly, and is easy to iterate for Part C.

## Complexity

| Operation | Time | Space |
|---|---|---|
| `setup` | O(N·L) | O(N·L) |
| `contains` | O(L) | O(1) extra |
| `startsWith` | TODO | TODO |
| `search` | TODO | TODO |

N = number of words, L = (average) word length; for `contains`, L is the query length. `setup` space is the worst case (no shared prefixes).

## Trade-offs

TODO

## Tests

```bash
npm test
```

Covered cases (`test/dictionary.test.ts`):

- **Setup**: words become queryable; a second `setup` replaces the first; duplicates are harmless; `setup([])` yields an empty dictionary.
- **Invalid words**: `setup` throws `TypeError` for uppercase (`"Cat"`, `"Dog"`), digit (`"ca1"`), symbol (`"c-t"`), space (`"ca t"`), non-ASCII (`"café"`) and the empty word (`""`, alone or among valid words); a failed `setup` keeps the previous contents.
- **Exact match** against `["cat", "car", "card"]`: `"cat"` and `"card"` are found; `"ca"` (prefix only), `"cards"` (extension), `"dog"` (absent), `"Cat"` and `"c?t"` (invalid characters, no throw) are not.
- **Edge cases**: query on a new dictionary before any `setup`; `contains("")` is always `false`, and `setup(["", "b"])` is rejected without touching the loaded words.
- **Factory**: two dictionaries from `createDictionary()` are independent — loading one does not affect the other.

Demo CLI (`test/cli.test.ts`):

- **Commands**: `setup` prints `Loaded N word(s).` (including `setup` with no words); an invalid word prints `Error: ...` and keeps the previous contents; `contains` prints `true` / `false` for loaded, prefix-only, invalid-character and empty-string queries, and `Usage: contains <word>` for extra arguments; `""` stands for the empty string, so `setup "" a` prints the empty-word error.
- **Session**: `help` lists the commands; unknown commands (including `""` as a command name) print a hint and the session continues; blank lines print nothing; `exit` / `quit` end the session.
- **End to end**: `src/cli.ts` is run as a child process with piped input — it starts by printing the command list with an empty dictionary, commands run in order, commands after `exit` are ignored, and the process exits with code 0 when input ends.
