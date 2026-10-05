## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Help and unknown commands

The command `help` SHALL print a usage summary listing the `setup`, `contains`, `startsWith`, `help`, and `exit` commands. The session SHALL print the same usage summary once when it starts. Any other command name SHALL print `Unknown command "<name>". Type "help" for usage.` and the session SHALL continue.

#### Scenario: Help lists commands

- **WHEN** `help` is entered
- **THEN** the output mentions `setup`, `contains`, `startsWith`, `help`, and `exit`

#### Scenario: Unknown command

- **WHEN** `add cat` is entered
- **THEN** `Unknown command "add". Type "help" for usage.` is printed and the next command still runs
