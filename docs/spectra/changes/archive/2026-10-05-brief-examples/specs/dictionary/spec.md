## MODIFIED Requirements

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

#### Scenario: Exact match examples from the interview brief

- **WHEN** `setup(["cat", "car", "bar"])` has been called
- **THEN** `contains("cat")` returns `true`, `contains("ca")` returns `false`, and `contains("bat")` returns `false`

#### Scenario: Query before any setup

- **WHEN** `contains("cat")` is called on a new dictionary with no prior `setup`
- **THEN** it returns `false`

#### Scenario: Empty string is never found

- **WHEN** `setup(["a"])` has been called
- **THEN** `contains("")` returns `false`

#### Scenario: Setup with the empty string keeps previous contents

- **WHEN** `setup(["a"])` succeeds and then `setup(["", "b"])` is called
- **THEN** a `TypeError` is thrown, `contains("a")` returns `true`, `contains("b")` returns `false`, and `contains("")` returns `false`

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

#### Scenario: Prefix examples from the interview brief

- **WHEN** `setup(["cat", "car", "bar"])` has been called
- **THEN** `startsWith("ca")` returns `true`, `startsWith("ba")` returns `true`, and `startsWith("cr")` returns `false`

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
