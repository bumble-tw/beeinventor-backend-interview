# dictionary-cli Specification

## Purpose

An interactive command line, started with `npm run demo` in `exercise-1-dictionary/`, that lets a person try the dictionary by typing commands such as `setup cat car` and `contains cat`, without writing or importing any code.

## Requirements

### Requirement: Interactive demo session

Running `npm run demo` in `exercise-1-dictionary/` SHALL start a session with one empty dictionary. The session SHALL read commands from standard input one line at a time, print each command's result on standard output, and continue until the command `exit` or `quit` is entered or the input ends; in both cases the process SHALL exit with code 0. Each line SHALL be split on whitespace: the first token is the command name and the remaining tokens are its arguments. The token `""` (two double-quote characters) SHALL stand for the empty string. A line containing only whitespace SHALL produce no output.

#### Scenario: Piped commands run in order

- **WHEN** the lines `setup cat car card`, `contains cat`, `contains ca`, and `exit` are piped to `npm run demo`
- **THEN** the output contains `Loaded 3 word(s).`, then `true`, then `false`, and the process exits with code 0

#### Scenario: Session ends when input ends

- **WHEN** the lines `setup cat` and `contains cat` are piped to `npm run demo` with no `exit` line
- **THEN** the output contains `true` and the process exits with code 0

#### Scenario: Blank line is ignored

- **WHEN** a line containing only spaces is entered
- **THEN** no output is printed for that line and the session continues


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
### Requirement: Setup command

The command `setup <word> <word> ...` SHALL call `setup` on the session dictionary with the given words, replacing its contents, and print `Loaded N word(s).` where N is the number of word tokens given. `setup` with no words SHALL empty the dictionary and print `Loaded 0 word(s).` When `setup` rejects a word, the command SHALL print `Error: ` followed by the error message, the dictionary SHALL keep its previous contents, and the session SHALL continue.

#### Scenario: Setup loads words

- **WHEN** `setup cat car card` is entered
- **THEN** `Loaded 3 word(s).` is printed and `contains card` then prints `true`

#### Scenario: Setup with an invalid word keeps previous contents

- **WHEN** `setup cat` is entered and then `setup dog Bad` is entered
- **THEN** the second command prints `Error: Invalid word "Bad": only lowercase a-z is allowed`, `contains cat` prints `true`, and `contains dog` prints `false`

#### Scenario: Setup with no words empties the dictionary

- **WHEN** `setup cat` is entered and then `setup` is entered
- **THEN** `Loaded 0 word(s).` is printed and `contains cat` prints `false`


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
### Requirement: Contains command

The command `contains <word>` SHALL print `true` or `false`, the result of calling `contains` on the session dictionary with that word. `contains` with no argument SHALL query the empty string. `contains` with more than one argument SHALL print `Usage: contains <word>` without querying.

#### Scenario: Contains prints lookup results

- **WHEN** `setup cat car card` has been entered and `contains` commands are entered
- **THEN** each prints the result of the dictionary lookup

##### Example: contains output

| Command | Output | Notes |
| ------- | ------ | ----- |
| `contains cat` | `true` | loaded word |
| `contains ca` | `false` | prefix only |
| `contains Cat` | `false` | invalid character, no error |
| `contains` | `false` | empty string, never a word |
| `contains ""` | `false` | empty string, never a word |
| `contains cat dog` | `Usage: contains <word>` | too many arguments |

#### Scenario: Empty string token

- **WHEN** `setup cat` is entered, then `setup "" a` is entered, then `contains ""` and `contains cat` are entered
- **THEN** `setup "" a` prints `Error: Invalid word "": empty words are not allowed`, `contains ""` prints `false`, and `contains cat` prints `true`


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
### Requirement: Help and unknown commands

The command `help` SHALL print a usage summary listing the `setup`, `contains`, `startsWith`, `search`, `help`, and `exit` commands. The session SHALL print the same usage summary once when it starts. Any other command name SHALL print `Unknown command "<name>". Type "help" for usage.` and the session SHALL continue.

#### Scenario: Help lists commands

- **WHEN** `help` is entered
- **THEN** the output mentions `setup`, `contains`, `startsWith`, `search`, `help`, and `exit`

#### Scenario: Unknown command

- **WHEN** `add cat` is entered
- **THEN** `Unknown command "add". Type "help" for usage.` is printed and the next command still runs


<!-- @trace
source: wildcard-search
updated: 2026-10-06
code:
  - exercise-1-dictionary/README.md
  - README.md
  - exercise-1-dictionary/src/dictionary.ts
  - exercise-1-dictionary/src/cli.ts
tests:
  - exercise-1-dictionary/test/dictionary.test.ts
  - exercise-1-dictionary/test/cli.test.ts
-->

---
### Requirement: StartsWith command

The command `startsWith <prefix>` SHALL print `true` or `false`, the result of calling `startsWith` on the session dictionary with that prefix. `startsWith` with no argument SHALL query the empty prefix, and the token `""` SHALL also stand for the empty prefix; both therefore print `false`. `startsWith` with more than one argument SHALL print `Usage: startsWith <prefix>` without querying.

#### Scenario: StartsWith prints prefix results

- **WHEN** `setup cat car card` has been entered and `startsWith` commands are entered
- **THEN** each prints the result of the prefix lookup

##### Example: startsWith output

| Command | Output | Notes |
| ------- | ------ | ----- |
| `startsWith ca` | `true` | prefix of loaded words |
| `startsWith card` | `true` | equals a loaded word |
| `startsWith cards` | `false` | longer than every loaded word |
| `startsWith dog` | `false` | not loaded |
| `startsWith Ca` | `false` | invalid character, no error |
| `startsWith` | `false` | empty prefix never matches |
| `startsWith ""` | `false` | empty prefix never matches |
| `startsWith ca da` | `Usage: startsWith <prefix>` | too many arguments |

#### Scenario: StartsWith on an empty session dictionary

- **WHEN** the session has just started and `startsWith c` is entered
- **THEN** `false` is printed

#### Scenario: StartsWith through the demo command

- **WHEN** the lines `setup cat car card`, `startsWith ca`, `startsWith x`, and `exit` are piped to `npm run demo`
- **THEN** the output contains `true` followed later by `false`, and the process exits with code 0

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

---
### Requirement: Search command

The command `search <pattern>` SHALL print `true` or `false`, the result of calling `search` on the session dictionary with that pattern. The `?` and `*` characters SHALL be passed to `search` unchanged. `search` with no argument SHALL query the empty pattern, and the token `""` SHALL also stand for the empty pattern; both therefore print `false`. `search` with more than one argument SHALL print `Usage: search <pattern>` without querying.

#### Scenario: Search prints wildcard results

- **WHEN** `setup cat car card` has been entered and `search` commands are entered
- **THEN** each prints the result of the wildcard lookup

##### Example: search output

| Command | Output | Notes |
| ------- | ------ | ----- |
| `search c?t` | `true` | `?` matches one character |
| `search ca*` | `true` | `*` matches the rest of the word |
| `search *d` | `true` | matches card |
| `search ca` | `false` | whole word required |
| `search ?????` | `false` | no five-letter word |
| `search Ca*` | `false` | invalid character, no error |
| `search` | `false` | empty pattern never matches |
| `search ""` | `false` | empty pattern never matches |
| `search c?t d*` | `Usage: search <pattern>` | too many arguments |

#### Scenario: Search on an empty session dictionary

- **WHEN** the session has just started and `search *` is entered
- **THEN** `false` is printed

#### Scenario: Search through the demo command

- **WHEN** the lines `setup cat car card`, `search c?r*`, `search *x*`, and `exit` are piped to `npm run demo`
- **THEN** the output contains `true` followed later by `false`, and the process exits with code 0

<!-- @trace
source: wildcard-search
updated: 2026-10-06
code:
  - exercise-1-dictionary/README.md
  - README.md
  - exercise-1-dictionary/src/dictionary.ts
  - exercise-1-dictionary/src/cli.ts
tests:
  - exercise-1-dictionary/test/dictionary.test.ts
  - exercise-1-dictionary/test/cli.test.ts
-->