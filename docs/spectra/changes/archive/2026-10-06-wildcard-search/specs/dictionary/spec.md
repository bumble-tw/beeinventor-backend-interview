## ADDED Requirements

### Requirement: Wildcard lookup

The system SHALL provide `search(pattern: string): boolean` that returns `true` when at least one word loaded by the most recent successful `setup` call matches `pattern` as a whole word, and `false` otherwise. In a pattern, `?` SHALL match exactly one character, `*` SHALL match zero or more characters, and every other character SHALL match only itself. A match SHALL cover the entire word: a pattern that matches only the beginning or a part of a loaded word SHALL NOT count. The empty pattern `""` SHALL never match: `search("")` SHALL return `false` regardless of the dictionary contents. Because the empty string is never a loaded word, `search("*")` SHALL return `true` exactly when the dictionary holds at least one word. `search` SHALL NOT throw for any string input; a pattern containing a character other than `a` through `z`, `?`, or `*` SHALL return `false`. A pattern with several `*` characters SHALL be answered without trying every way of splitting a word among them, so its running time grows at most with the number of trie nodes times the pattern length.

#### Scenario: Wildcard lookups

- **WHEN** `setup(["cat", "car", "card", "dog"])` has been called and `search` is queried
- **THEN** it returns `true` only when some loaded word matches the whole pattern

##### Example: wildcard results

| Pattern | Expected | Notes |
| ------- | -------- | ----- |
| `"cat"` | `true` | no wildcard, behaves like exact match |
| `"ca"` | `false` | matches only the beginning of loaded words |
| `"c?t"` | `true` | `?` matches `a` |
| `"?a?"` | `true` | matches cat and car |
| `"????"` | `true` | matches card |
| `"?????"` | `false` | no five-letter word |
| `"?"` | `false` | no one-letter word |
| `"ca*"` | `true` | `*` matches the rest of cat, car, card |
| `"car*"` | `true` | `*` matches zero characters (car) |
| `"*d"` | `true` | matches card |
| `"c*r*d"` | `true` | several `*`, matches card |
| `"*o*"` | `true` | matches dog |
| `"**"` | `true` | consecutive `*` behave like one |
| `"*"` | `true` | any loaded word |
| `"d?g*"` | `true` | `?` then `*` matching zero characters |
| `"ca*s"` | `false` | no loaded word starting with ca ends with s |
| `"*x*"` | `false` | no loaded word contains x |
| `""` | `false` | empty pattern never matches |
| `"Ca*"` | `false` | invalid character, no throw |
| `"c.t"` | `false` | invalid character, no throw |

#### Scenario: Wildcard examples from the interview brief

- **WHEN** `setup(["cat", "car", "bar"])` has been called
- **THEN** `search("c?t")` returns `true`, `search("*at")` returns `true`, `search("ca*")` returns `true`, `search("cr*")` returns `false`, and `search("*")` returns `true`

#### Scenario: Wildcard query before any setup

- **WHEN** `search("*")`, `search("?")`, and `search("")` are called on a new dictionary with no prior `setup`
- **THEN** all three return `false`

#### Scenario: Wildcard lookup on an emptied dictionary

- **WHEN** `setup(["cat"])` is called and then `setup([])` is called
- **THEN** `search("*")` returns `false`

#### Scenario: Wildcard lookup follows setup replacement

- **WHEN** `setup(["cat"])` is called and then `setup(["dog"])` is called
- **THEN** `search("c*")` returns `false` and `search("d*")` returns `true`

#### Scenario: Failed setup keeps wildcard results

- **WHEN** `setup(["cat"])` succeeds and then `setup(["dog", "Bad"])` throws
- **THEN** `search("c?t")` returns `true` and `search("d*")` returns `false`

#### Scenario: Many stars do not cause exponential work

- **WHEN** `setup(["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"])` (thirty `a` characters) has been called and `search` is called with `*a` repeated fifteen times followed by `b`
- **THEN** it returns `false` within one second
