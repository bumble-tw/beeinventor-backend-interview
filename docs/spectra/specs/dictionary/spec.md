# dictionary Specification

## Purpose

An in-memory dictionary that loads a list of lowercase English words and answers lookup queries against them. It is the shared foundation for exact-match, prefix, and wildcard queries in Exercise 1.

## Requirements

### Requirement: Load dictionary contents

The system SHALL provide `setup(words: string[]): void` that loads the given words into the dictionary. Each call SHALL replace all previously loaded contents. Duplicate words SHALL NOT change any query result. A word SHALL be valid when it has at least one character and every character is in the range `a` through `z`; the empty string `""` SHALL NOT be a valid word, so it never exists in the dictionary.

#### Scenario: Words become queryable after setup

- **WHEN** `setup(["cat", "car", "dog"])` is called
- **THEN** `contains("cat")`, `contains("car")`, and `contains("dog")` each return `true`

#### Scenario: Setup replaces previous contents

- **WHEN** `setup(["cat"])` is called and then `setup(["dog"])` is called
- **THEN** `contains("cat")` returns `false` and `contains("dog")` returns `true`

#### Scenario: Duplicate words are harmless

- **WHEN** `setup(["cat", "cat"])` is called
- **THEN** `contains("cat")` returns `true`

#### Scenario: Empty word list yields an empty dictionary

- **WHEN** `setup([])` is called
- **THEN** `contains` returns `false` for every input, including `""`


<!-- @trace
source: exact-match
updated: 2026-10-05
code:
  - exercise-1-dictionary/src/dictionary.ts
  - exercise-1-dictionary/README.md
  - exercise-1-dictionary/src/cli.ts
tests:
  - exercise-1-dictionary/test/dictionary.test.ts
  - exercise-1-dictionary/test/cli.test.ts
-->

---
### Requirement: Reject invalid words on setup

`setup` SHALL throw a `TypeError` when any word is the empty string `""` or contains a character outside `a` through `z`. When it throws, the dictionary MUST keep the contents it had before that call.

#### Scenario: Invalid word is rejected

- **WHEN** `setup(["cat", "Dog"])` is called
- **THEN** a `TypeError` is thrown

##### Example: invalid inputs

| Input to setup | Expected | Notes |
| -------------- | -------- | ----- |
| `["Cat"]` | throws `TypeError` | uppercase |
| `["ca1"]` | throws `TypeError` | digit |
| `["c-t"]` | throws `TypeError` | symbol |
| `["ca t"]` | throws `TypeError` | space |
| `["café"]` | throws `TypeError` | non-ASCII letter |
| `[""]` | throws `TypeError` | empty word |
| `["cat", ""]` | throws `TypeError` | empty word among valid words |

#### Scenario: Failed setup keeps previous contents

- **WHEN** `setup(["cat"])` succeeds and then `setup(["dog", "Bad"])` throws
- **THEN** `contains("cat")` returns `true` and `contains("dog")` returns `false`


<!-- @trace
source: exact-match
updated: 2026-10-05
code:
  - exercise-1-dictionary/src/dictionary.ts
  - exercise-1-dictionary/README.md
  - exercise-1-dictionary/src/cli.ts
tests:
  - exercise-1-dictionary/test/dictionary.test.ts
  - exercise-1-dictionary/test/cli.test.ts
-->

---
### Requirement: Exact match lookup

The system SHALL provide `contains(word: string): boolean` that returns `true` only when `word` was loaded by the most recent successful `setup` call, and `false` otherwise. A loaded word that merely starts with `word`, or is a prefix of `word`, SHALL NOT count as a match. `contains` SHALL NOT throw for any string input; a string containing characters outside `a` through `z` SHALL return `false`, and `contains("")` SHALL always return `false`.

#### Scenario: Exact match lookups

- **WHEN** `setup(["cat", "car", "card"])` has been called and `contains` is queried
- **THEN** it returns `true` only for words in the list

##### Example: lookup results

| Query | Expected | Notes |
| ----- | -------- | ----- |
| `"cat"` | `true` | loaded word |
| `"card"` | `true` | loaded word that extends another loaded word |
| `"ca"` | `false` | prefix of loaded words, not itself loaded |
| `"cards"` | `false` | extends a loaded word |
| `"dog"` | `false` | not loaded |
| `"Cat"` | `false` | invalid character, no throw |
| `"c?t"` | `false` | invalid character, no throw |

#### Scenario: Query before any setup

- **WHEN** `contains("cat")` is called on a new dictionary with no prior `setup`
- **THEN** it returns `false`

#### Scenario: Empty string is never found

- **WHEN** `setup(["a"])` has been called
- **THEN** `contains("")` returns `false`

#### Scenario: Setup with the empty string keeps previous contents

- **WHEN** `setup(["a"])` succeeds and then `setup(["", "b"])` is called
- **THEN** a `TypeError` is thrown, `contains("a")` returns `true`, `contains("b")` returns `false`, and `contains("")` returns `false`

<!-- @trace
source: exact-match
updated: 2026-10-05
code:
  - exercise-1-dictionary/src/dictionary.ts
  - exercise-1-dictionary/README.md
  - exercise-1-dictionary/src/cli.ts
tests:
  - exercise-1-dictionary/test/dictionary.test.ts
  - exercise-1-dictionary/test/cli.test.ts
-->

---
### Requirement: Prefix lookup

The system SHALL provide `startsWith(prefix: string): boolean` that returns `true` when at least one word loaded by the most recent successful `setup` call starts with `prefix`, and `false` otherwise. A loaded word equal to `prefix` SHALL count as starting with it. The empty prefix `""` SHALL never match: `startsWith("")` SHALL return `false` regardless of the dictionary contents. `startsWith` SHALL NOT throw for any string input; a prefix containing characters outside `a` through `z` SHALL return `false`.

#### Scenario: Prefix lookups

- **WHEN** `setup(["cat", "car", "card", "dog"])` has been called and `startsWith` is queried
- **THEN** it returns `true` only when some loaded word starts with the prefix

##### Example: prefix results

| Prefix | Expected | Notes |
| ------ | -------- | ----- |
| `"ca"` | `true` | shared by cat, car, card |
| `"c"` | `true` | single letter |
| `"d"` | `true` | first letter of dog |
| `"car"` | `true` | equals a loaded word and is a prefix of card |
| `"card"` | `true` | equals a loaded word with nothing below it |
| `"cards"` | `false` | longer than every loaded word |
| `"cow"` | `false` | path ends after `c` |
| `"x"` | `false` | no word starts with it |
| `""` | `false` | empty prefix never matches |
| `"Ca"` | `false` | invalid character, no throw |
| `"c?"` | `false` | invalid character, no throw |

#### Scenario: Prefix query before any setup

- **WHEN** `startsWith("")` and `startsWith("a")` are called on a new dictionary with no prior `setup`
- **THEN** both return `false`

#### Scenario: Prefix lookup on an emptied dictionary

- **WHEN** `setup(["cat"])` is called and then `setup([])` is called
- **THEN** `startsWith("c")` returns `false`

#### Scenario: Prefix lookup follows setup replacement

- **WHEN** `setup(["cat"])` is called and then `setup(["dog"])` is called
- **THEN** `startsWith("c")` returns `false` and `startsWith("d")` returns `true`

#### Scenario: Failed setup keeps prefix results

- **WHEN** `setup(["cat"])` succeeds and then `setup(["dog", "Bad"])` throws
- **THEN** `startsWith("c")` returns `true` and `startsWith("d")` returns `false`

<!-- @trace
source: prefix-search
updated: 2026-10-05
code:
  - exercise-1-dictionary/README.md
  - exercise-1-dictionary/src/cli.ts
  - exercise-1-dictionary/src/dictionary.ts
  - CLAUDE.md
  - README.md
tests:
  - exercise-1-dictionary/test/cli.test.ts
  - exercise-1-dictionary/test/dictionary.test.ts
-->