import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { runCommand } from "../src/cli.ts";
import { createDictionary } from "../src/dictionary.ts";
import type { Dictionary } from "../src/dictionary.ts";

/** Runs each line in order against one dictionary and returns the printed outputs. */
function run(dict: Dictionary, ...lines: string[]): string[] {
  return lines.map((line) => runCommand(dict, line).output);
}

describe("Setup command", () => {
  it("Setup loads words", () => {
    const dict = createDictionary();
    assert.deepEqual(run(dict, "setup cat car card", "contains card"), ["Loaded 3 word(s).", "true"]);
  });

  it("Setup with an invalid word keeps previous contents", () => {
    const dict = createDictionary();
    assert.deepEqual(run(dict, "setup cat", "setup dog Bad", "contains cat", "contains dog"), [
      "Loaded 1 word(s).",
      'Error: Invalid word "Bad": only lowercase a-z is allowed',
      "true",
      "false",
    ]);
  });

  it("Setup with no words empties the dictionary", () => {
    const dict = createDictionary();
    assert.deepEqual(run(dict, "setup cat", "setup", "contains cat"), [
      "Loaded 1 word(s).",
      "Loaded 0 word(s).",
      "false",
    ]);
  });
});

describe("Contains command", () => {
  describe("Contains prints lookup results (Example: contains output)", () => {
    const cases: Array<[command: string, expected: string, note: string]> = [
      ["contains cat", "true", "loaded word"],
      ["contains ca", "false", "prefix only"],
      ["contains Cat", "false", "invalid character, no error"],
      ["contains", "false", "empty string, never a word"],
      ['contains ""', "false", "empty string, never a word"],
      ["contains cat dog", "Usage: contains <word>", "too many arguments"],
    ];

    for (const [command, expected, note] of cases) {
      it(`${command} prints ${expected} — ${note}`, () => {
        const dict = createDictionary();
        runCommand(dict, "setup cat car card");
        assert.equal(runCommand(dict, command).output, expected);
      });
    }
  });

  it("Empty string token", () => {
    const dict = createDictionary();
    assert.deepEqual(run(dict, "setup cat", 'setup "" a', 'contains ""', "contains cat"), [
      "Loaded 1 word(s).",
      'Error: Invalid word "": empty words are not allowed',
      "false",
      "true",
    ]);
  });
});

describe("Help and unknown commands", () => {
  it("Help lists commands", () => {
    const { output, exit } = runCommand(createDictionary(), "help");
    for (const command of ["setup", "contains", "help", "exit"]) {
      assert.match(output, new RegExp(`\\b${command}\\b`), `help mentions ${command}`);
    }
    assert.equal(exit, false);
  });

  it("Unknown command", () => {
    const dict = createDictionary();
    assert.deepEqual(run(dict, "add cat", "setup cat", "contains cat"), [
      'Unknown command "add". Type "help" for usage.',
      "Loaded 1 word(s).",
      "true",
    ]);
  });

  it('Unknown command "" (the empty-string token is not a command)', () => {
    assert.equal(runCommand(createDictionary(), '"" cat').output, 'Unknown command "". Type "help" for usage.');
  });
});

describe("Interactive demo session", () => {
  it("Blank line is ignored", () => {
    assert.deepEqual(runCommand(createDictionary(), "   "), { output: "", exit: false });
  });

  for (const command of ["exit", "quit"]) {
    it(`${command} ends the session`, () => {
      assert.deepEqual(runCommand(createDictionary(), command), { output: "", exit: true });
    });
  }
});

describe("Interactive demo session (running src/cli.ts)", () => {
  const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

  /** Runs the CLI as a child process with the given lines piped to stdin. */
  function runCli(...lines: string[]): { lines: string[]; status: number | null } {
    const result = spawnSync(process.execPath, [cliPath], { input: lines.join("\n") + "\n", encoding: "utf8" });
    return { lines: result.stdout.split("\n"), status: result.status };
  }

  /** Asserts that `expected` appear in `actual` in this order (other lines may come between). */
  function assertInOrder(actual: string[], expected: string[]): void {
    let from = 0;
    for (const line of expected) {
      const index = actual.indexOf(line, from);
      assert.notEqual(index, -1, `expected ${JSON.stringify(line)} after position ${from} in:\n${actual.join("\n")}`);
      from = index + 1;
    }
  }

  it("Piped commands run in order", () => {
    const { lines, status } = runCli("setup cat car card", "contains cat", "contains ca", "exit");
    assertInOrder(lines, ["Loaded 3 word(s).", "true", "false"]);
    assert.equal(status, 0);
  });

  it("Session starts with the usage summary and an empty dictionary", () => {
    const { lines, status } = runCli("contains cat");
    assertInOrder(lines, ["Commands:", "false"]);
    assert.equal(lines[0], "Commands:");
    assert.equal(status, 0);
  });

  it("Commands after exit are not run", () => {
    const { lines, status } = runCli("setup cat", "exit", "contains cat");
    assert.equal(lines.includes("true"), false, `no output expected after exit in:\n${lines.join("\n")}`);
    assert.equal(status, 0);
  });

  it("Session ends when input ends", () => {
    const { lines, status } = runCli("setup cat", "contains cat");
    assertInOrder(lines, ["true"]);
    assert.equal(status, 0);
  });
});
