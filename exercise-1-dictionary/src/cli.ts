import { createInterface } from "node:readline";

import { createDictionary } from "./dictionary.ts";
import type { Dictionary } from "./dictionary.ts";

export interface CommandResult {
  output: string; // text to print; empty string means print nothing
  exit: boolean; // true ends the session
}

// The token `""` stands for the empty string, which whitespace splitting cannot otherwise express.
const EMPTY_STRING_TOKEN = '""';

export const HELP = `Commands:
  setup <word> <word> ...   load these words, replacing the dictionary (words: lowercase a-z)
  contains <word>           print true if the word was loaded, otherwise false
  startsWith <prefix>       print true if any loaded word starts with the prefix, otherwise false
  help                      show this message
  exit                      end the session (or: quit, Ctrl+D)
"" stands for the empty string, which is never a word: setup "" is rejected, contains "" and startsWith "" print false`;

export function runCommand(dict: Dictionary, line: string): CommandResult {
  if (line.trim() === "") return print(""); // blank line

  const [command, ...tokens] = line.trim().split(/\s+/);
  const args = tokens.map((token) => (token === EMPTY_STRING_TOKEN ? "" : token));

  switch (command) {
    case "setup":
      try {
        dict.setup(args);
      } catch (error) {
        return print(`Error: ${(error as Error).message}`);
      }
      return print(`Loaded ${args.length} word(s).`);

    case "contains":
      if (args.length > 1) return print("Usage: contains <word>");
      return print(String(dict.contains(args[0] ?? "")));

    case "startsWith":
      if (args.length > 1) return print("Usage: startsWith <prefix>");
      return print(String(dict.startsWith(args[0] ?? "")));

    case "help":
      return print(HELP);

    case "exit":
    case "quit":
      return { output: "", exit: true };

    default:
      return print(`Unknown command "${command === EMPTY_STRING_TOKEN ? "" : command}". Type "help" for usage.`);
  }
}

function print(output: string): CommandResult {
  return { output, exit: false };
}

// Start an interactive session only when run directly (`npm run demo`), not when imported by tests.
if (import.meta.main) {
  const dict = createDictionary();
  const interactive = process.stdin.isTTY === true;
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: interactive });

  console.log(HELP);
  if (interactive) rl.prompt();

  // readline may still emit lines already buffered from piped input after close(), so ignore them.
  let ended = false;
  rl.on("line", (line) => {
    if (ended) return;
    const { output, exit } = runCommand(dict, line);
    if (output !== "") console.log(output);
    if (exit) {
      ended = true;
      rl.close();
      return;
    }
    if (interactive) rl.prompt();
  });
}
