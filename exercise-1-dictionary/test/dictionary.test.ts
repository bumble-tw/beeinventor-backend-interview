import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDictionary } from "../src/dictionary.ts";
import type { Dictionary } from "../src/dictionary.ts";

function dictionaryWith(words: string[]): Dictionary {
  const dict = createDictionary();
  dict.setup(words);
  return dict;
}

describe("Load dictionary contents", () => {
  it("Words become queryable after setup", () => {
    const dict = dictionaryWith(["cat", "car", "dog"]);
    assert.equal(dict.contains("cat"), true);
    assert.equal(dict.contains("car"), true);
    assert.equal(dict.contains("dog"), true);
  });

  it("Setup replaces previous contents", () => {
    const dict = dictionaryWith(["cat"]);
    dict.setup(["dog"]);
    assert.equal(dict.contains("cat"), false);
    assert.equal(dict.contains("dog"), true);
  });

  it("Duplicate words are harmless", () => {
    const dict = dictionaryWith(["cat", "cat"]);
    assert.equal(dict.contains("cat"), true);
  });

  it("Empty word list yields an empty dictionary", () => {
    const dict = dictionaryWith([]);
    for (const query of ["", "a", "cat"]) {
      assert.equal(dict.contains(query), false, `contains(${JSON.stringify(query)})`);
    }
  });
});

describe("Factory", () => {
  it("Separate dictionaries are independent", () => {
    const a = createDictionary();
    const b = createDictionary();
    a.setup(["cat"]);
    b.setup(["dog"]);
    assert.equal(a.contains("cat"), true);
    assert.equal(a.contains("dog"), false);
    assert.equal(b.contains("dog"), true);
    assert.equal(b.contains("cat"), false);
  });
});

describe("Reject invalid words on setup", () => {
  it("Invalid word is rejected", () => {
    const dict = createDictionary();
    assert.throws(() => dict.setup(["cat", "Dog"]), TypeError);
  });

  describe("Example: invalid inputs", () => {
    const cases: Array<[input: string[], note: string]> = [
      [["Cat"], "uppercase"],
      [["ca1"], "digit"],
      [["c-t"], "symbol"],
      [["ca t"], "space"],
      [["café"], "non-ASCII letter"],
      [[""], "empty word"],
      [["cat", ""], "empty word among valid words"],
    ];

    for (const [input, note] of cases) {
      it(`setup(${JSON.stringify(input)}) throws TypeError — ${note}`, () => {
        const dict = createDictionary();
        assert.throws(() => dict.setup(input), TypeError);
      });
    }
  });

  it("Failed setup keeps previous contents", () => {
    const dict = dictionaryWith(["cat"]);
    assert.throws(() => dict.setup(["dog", "Bad"]), TypeError);
    assert.equal(dict.contains("cat"), true);
    assert.equal(dict.contains("dog"), false);
  });
});

describe("Exact match lookup", () => {
  it("Query before any setup: returns false on a new dictionary", () => {
    const dict = createDictionary();
    assert.equal(dict.contains("cat"), false);
  });

  describe("Exact match lookups (Example: lookup results)", () => {
    const cases: Array<[query: string, expected: boolean, note: string]> = [
      ["cat", true, "loaded word"],
      ["card", true, "loaded word that extends another loaded word"],
      ["ca", false, "prefix of loaded words, not itself loaded"],
      ["cards", false, "extends a loaded word"],
      ["dog", false, "not loaded"],
      ["Cat", false, "invalid character, no throw"],
      ["c?t", false, "invalid character, no throw"],
    ];

    for (const [query, expected, note] of cases) {
      it(`contains(${JSON.stringify(query)}) is ${expected} — ${note}`, () => {
        const dict = dictionaryWith(["cat", "car", "card"]);
        assert.equal(dict.contains(query), expected);
      });
    }
  });

  it("Exact match examples from the interview brief", () => {
    const dict = dictionaryWith(["cat", "car", "bar"]);
    assert.equal(dict.contains("cat"), true);
    assert.equal(dict.contains("ca"), false);
    assert.equal(dict.contains("bat"), false);
  });

  it("Setup with the empty string keeps previous contents", () => {
    const dict = dictionaryWith(["a"]);
    assert.throws(() => dict.setup(["", "b"]), TypeError);
    assert.equal(dict.contains("a"), true);
    assert.equal(dict.contains("b"), false);
    assert.equal(dict.contains(""), false);
  });

  it("Empty string is never found", () => {
    const dict = dictionaryWith(["a"]);
    assert.equal(dict.contains(""), false);
  });
});

describe("Prefix lookup", () => {
  describe("Prefix lookups (Example: prefix results)", () => {
    const cases: Array<[prefix: string, expected: boolean, note: string]> = [
      ["ca", true, "shared by cat, car, card"],
      ["c", true, "single letter"],
      ["d", true, "first letter of dog"],
      ["car", true, "equals a loaded word and is a prefix of card"],
      ["card", true, "equals a loaded word with nothing below it"],
      ["cards", false, "longer than every loaded word"],
      ["cow", false, "path ends after c"],
      ["x", false, "no word starts with it"],
      ["", false, "empty prefix never matches"],
      ["Ca", false, "invalid character, no throw"],
      ["c?", false, "invalid character, no throw"],
    ];

    for (const [prefix, expected, note] of cases) {
      it(`startsWith(${JSON.stringify(prefix)}) is ${expected} — ${note}`, () => {
        const dict = dictionaryWith(["cat", "car", "card", "dog"]);
        assert.equal(dict.startsWith(prefix), expected);
      });
    }
  });

  it("Prefix examples from the interview brief", () => {
    const dict = dictionaryWith(["cat", "car", "bar"]);
    assert.equal(dict.startsWith("ca"), true);
    assert.equal(dict.startsWith("ba"), true);
    assert.equal(dict.startsWith("cr"), false);
  });

  it("Prefix query before any setup", () => {
    const dict = createDictionary();
    assert.equal(dict.startsWith(""), false);
    assert.equal(dict.startsWith("a"), false);
  });

  it("Prefix lookup on an emptied dictionary", () => {
    const dict = dictionaryWith(["cat"]);
    dict.setup([]);
    assert.equal(dict.startsWith("c"), false);
  });

  it("Prefix lookup follows setup replacement", () => {
    const dict = dictionaryWith(["cat"]);
    dict.setup(["dog"]);
    assert.equal(dict.startsWith("c"), false);
    assert.equal(dict.startsWith("d"), true);
  });

  it("Failed setup keeps prefix results", () => {
    const dict = dictionaryWith(["cat"]);
    assert.throws(() => dict.setup(["dog", "Bad"]), TypeError);
    assert.equal(dict.startsWith("c"), true);
    assert.equal(dict.startsWith("d"), false);
  });
});
