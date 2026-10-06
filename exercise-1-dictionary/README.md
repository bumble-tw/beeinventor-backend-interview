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
> startsWith ca
true
> startsWith x
false
> search c?r*
true
> search *x*
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
| `startsWith <prefix>` | Print `true` if any loaded word starts with the prefix, otherwise `false` |
| `search <pattern>` | Print `true` if any loaded word matches the whole pattern (`?` = one letter, `*` = zero or more), otherwise `false` |
| `help` | Show the command list |
| `exit` / `quit` / Ctrl+D | End the session |

Type `""` for the empty string, which is never a word: `setup ""` is rejected, and `contains ""`, `startsWith ""` and `search ""` print `false`. Commands can also be piped in: `printf 'setup cat\ncontains cat\n' | npm run demo`.

## API

Create a dictionary with `createDictionary()`, then call its methods:

```ts
import { createDictionary } from "./src/dictionary.ts";

const dict = createDictionary();
dict.setup(["cat", "car", "card"]);
dict.contains("cat");  // true
dict.contains("ca");   // false
dict.startsWith("ca"); // true
dict.search("c?r*");   // true
```

Each `createDictionary()` call returns an independent dictionary with these methods:

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
- The empty string `""` is never a word: `setup` rejects it with a `TypeError` (`Invalid word "": empty words are not allowed`), and `contains("")` is always `false`.
- An empty dictionary (freshly created, or after `setup([])`) returns `false` for every query.
- `setup` throws a `TypeError` (naming the offending word) if any word contains a character outside `a-z`; the dictionary keeps the contents it had before that call.
- `contains` never throws: a query containing a character outside `a-z` simply returns `false`.
- `startsWith("")` is always `false`, whatever the dictionary holds: the empty string does not exist in the dictionary at all, so it is not a valid prefix either.
- `startsWith` never throws: a prefix containing a character outside `a-z` simply returns `false`.
- A loaded word counts as starting with itself: after `setup(["card"])`, `startsWith("card")` is `true`.
- `search` matches the whole word, not part of it: after `setup(["cat"])`, `search("ca")` is `false` and `search("ca*")` is `true`.
- `search("")` is always `false`. `search("*")` is `true` exactly when the dictionary holds at least one word, since the empty string is never a word.
- `search` never throws: a pattern containing a character other than `a-z`, `?` or `*` (uppercase included) simply returns `false`.

## Data structure choice

A **Trie** (prefix tree). Each node holds a `Map<string, TrieNode>` of children and an `isEnd` flag marking the end of a loaded word. `contains` walks the trie one character at a time and returns the `isEnd` flag of the node it lands on, so prefixes of loaded words are not false positives. `startsWith` shares the same walk and differs only in the final check: since nodes are created only along loaded words (and never removed), reaching the prefix's node at all means some word starts with it.

`setup` validates every word first, builds a brand-new trie, and only then swaps it in — so a failed `setup` never leaves half-loaded contents. Traversal is iterative (no recursion), so very long words cannot overflow the stack.

`search` walks the trie depth-first with an explicit stack of states `(node, i)`: "standing on `node`, with the first `i` pattern characters consumed". A letter follows its one edge, `?` follows every edge, and `*` either consumes nothing (move on to `i + 1`) or consumes one more letter (follow every edge, stay on `*`). A word matches when the whole pattern is consumed on a node marked `isEnd`. Because a state's outcome depends only on `(node, i)`, each state is expanded at most once (tracked in a per-call `Map<TrieNode, Set<number>>`); without that, a pattern like `*a*a*a…b` would retry every way of splitting a word among its stars and take exponential time.

The API is a **factory function**: `createDictionary()` keeps the trie root in a local variable that only the returned methods can reach (a closure), so callers cannot touch the internals and every dictionary is independent. Plain module-level `setup` / `contains` functions were rejected because they would share one global dictionary across the whole program — tests would leak state into each other and two dictionaries could not coexist.

Alternatives considered:

- **`Set<string>`** — simplest, and `contains` is also O(L) (hashing reads the whole string). Rejected because Part B (prefix) would need a full scan or a second index, and Part C (wildcard) could not prune the search.
- **`Set` + Trie together** — slightly faster exact match, but doubles memory and keeps two copies in sync; not worth it here.
- **26-slot array per node** (indexed by `charCode - 97`) — marginally faster lookup, but every node allocates 26 slots even when sparse. A `Map` stores only existing branches, reads more clearly, and is easy to iterate for Part C.

## Complexity

| Operation | Time | Space |
|---|---|---|
| `setup` | O(N·L) | O(N·L) |
| `contains` | O(L) | O(1) extra |
| `startsWith` | O(P) | O(1) extra |
| `search` | O(M) without wildcards; O(T·M) worst case | O(T·M) extra, worst case |

N = number of words, L = (average) word length; for `contains`, L is the query length; P = prefix length; M = pattern length; T = number of trie nodes (at most N·L). `setup` space is the worst case (no shared prefixes). For `search`, each `(node, i)` state is expanded once, so wildcards cost at most every trie node times every pattern position; letters before the first wildcard narrow the walk to one branch.

## Trade-offs

- **Trie over a word set.** Prefix and wildcard queries follow only the branches that can still match, and shared prefixes are stored once. The cost is more memory per character than a `Set<string>` (one `Map` per node) and slightly slower exact lookups.
- **Leading `*` cannot prune.** A pattern such as `*d` has no fixed first letter, so `search` may visit the whole trie (O(T·M)). A second, reversed trie would make suffix patterns fast, but it doubles memory and only helps patterns that end in letters; it was not added.
- **Memoized states trade memory for time.** The visited-state map can grow to O(T·M) during one call, but it turns an exponential worst case (many `*`) into a polynomial one. It is created per call and discarded afterwards.
- **No regular expressions.** Converting the pattern to a `RegExp` and testing every word is simpler to write, but it scans all N words on every query and cannot use the trie, and backtracking regex engines can themselves blow up on many `*`.
- **Strict loading, lenient queries.** `setup` rejects bad words so the dictionary stays clean; queries return `false` for input that cannot match instead of throwing, so callers can treat them as plain yes/no checks.

## Tests

```bash
npm test
```

Covered cases (`test/dictionary.test.ts`):

- **Setup**: words become queryable; a second `setup` replaces the first; duplicates are harmless; `setup([])` yields an empty dictionary.
- **Invalid words**: `setup` throws `TypeError` for uppercase (`"Cat"`, `"Dog"`), digit (`"ca1"`), symbol (`"c-t"`), space (`"ca t"`), non-ASCII (`"café"`) and the empty word (`""`, alone or among valid words); a failed `setup` keeps the previous contents.
- **Exact match** against `["cat", "car", "card"]`: `"cat"` and `"card"` are found; `"ca"` (prefix only), `"cards"` (extension), `"dog"` (absent), `"Cat"` and `"c?t"` (invalid characters, no throw) are not. The brief's own example is also covered: after `setup(["cat", "car", "bar"])`, `"cat"` is found and `"ca"` and `"bat"` are not.
- **Edge cases**: query on a new dictionary before any `setup`; `contains("")` is always `false`, and `setup(["", "b"])` is rejected without touching the loaded words.
- **Prefix search** against `["cat", "car", "card", "dog"]`: `"ca"`, `"c"`, `"d"`, `"car"` and `"card"` (whole words count) match; `"cards"` (longer than every word), `"cow"`, `"x"`, `""` (empty prefix), `"Ca"` and `"c?"` (invalid characters, no throw) do not. Also: no match before any `setup` or after `setup([])`, results follow a replacing `setup`, and a failed `setup` keeps the previous prefix results. The brief's own example is also covered: against `["cat", "car", "bar"]`, `"ca"` and `"ba"` match and `"cr"` does not.
- **Wildcard search** against `["cat", "car", "card", "dog"]`: `"cat"`, `"c?t"`, `"?a?"`, `"????"`, `"ca*"`, `"car*"` (`*` matching nothing), `"*d"`, `"c*r*d"`, `"*o*"`, `"**"`, `"*"` and `"d?g*"` match; `"ca"` (whole word required), `"?????"`, `"?"`, `"ca*s"`, `"*x*"`, `""` (empty pattern), `"Ca*"` and `"c.t"` (invalid characters, no throw) do not. Also: no match before any `setup` or after `setup([])`, results follow a replacing `setup`, a failed `setup` keeps the previous results, and `"*a"` repeated 15 times plus `"b"` against a 30-letter word returns `false` in under one second. The brief's own example is also covered: against `["cat", "car", "bar"]`, `"c?t"`, `"*at"`, `"ca*"` and `"*"` match and `"cr*"` does not.
- **Factory**: two dictionaries from `createDictionary()` are independent — loading one does not affect the other.

Demo CLI (`test/cli.test.ts`):

- **Commands**: `setup` prints `Loaded N word(s).` (including `setup` with no words); an invalid word prints `Error: ...` and keeps the previous contents; `contains` prints `true` / `false` for loaded, prefix-only, invalid-character and empty-string queries, and `Usage: contains <word>` for extra arguments; `startsWith` prints `true` / `false` for prefix, whole-word, too-long, absent, invalid-character and empty prefixes (including on a fresh session), and `Usage: startsWith <prefix>` for extra arguments; `search` prints `true` / `false` for `?` / `*` patterns, whole-word, too-long, invalid-character and empty patterns (including on a fresh session), and `Usage: search <pattern>` for extra arguments; `""` stands for the empty string, so `setup "" a` prints the empty-word error.
- **Session**: `help` lists the commands; unknown commands (including `""` as a command name) print a hint and the session continues; blank lines print nothing; `exit` / `quit` end the session.
- **End to end**: `src/cli.ts` is run as a child process with piped input — it starts by printing the command list with an empty dictionary, commands run in order (including `startsWith` and `search`), commands after `exit` are ignored, and the process exits with code 0 when input ends.
