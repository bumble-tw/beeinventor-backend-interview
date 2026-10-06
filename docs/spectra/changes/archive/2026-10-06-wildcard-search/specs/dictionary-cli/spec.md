## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Help and unknown commands

The command `help` SHALL print a usage summary listing the `setup`, `contains`, `startsWith`, `search`, `help`, and `exit` commands. The session SHALL print the same usage summary once when it starts. Any other command name SHALL print `Unknown command "<name>". Type "help" for usage.` and the session SHALL continue.

#### Scenario: Help lists commands

- **WHEN** `help` is entered
- **THEN** the output mentions `setup`, `contains`, `startsWith`, `search`, `help`, and `exit`

#### Scenario: Unknown command

- **WHEN** `add cat` is entered
- **THEN** `Unknown command "add". Type "help" for usage.` is printed and the next command still runs
