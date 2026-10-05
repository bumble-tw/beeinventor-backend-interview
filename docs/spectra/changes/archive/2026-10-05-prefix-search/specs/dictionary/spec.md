## ADDED Requirements

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
