// A word is one or more lowercase letters; the empty string is never a word.
const VALID_WORD = /^[a-z]+$/;

interface TrieNode {
  readonly children: Map<string, TrieNode>;
  isEnd: boolean;
}

function createNode(): TrieNode {
  return { children: new Map(), isEnd: false };
}

export interface Dictionary {
  setup(words: string[]): void;
  contains(word: string): boolean;
  startsWith(prefix: string): boolean;
  search(pattern: string): boolean;
}

export function createDictionary(): Dictionary {
  let root = createNode();

  // Walks from the root one character at a time; returns the node reached, or undefined if the path breaks.
  // The empty string reaches the root itself.
  function findNode(text: string): TrieNode | undefined {
    let node: TrieNode | undefined = root;
    for (const char of text) {
      node = node.children.get(char);
      if (node === undefined) return undefined;
    }
    return node;
  }

  return {
    setup(words: string[]): void {
      // Validate everything before building, so a bad word leaves the current contents untouched.
      for (const word of words) {
        if (word === "") {
          throw new TypeError('Invalid word "": empty words are not allowed');
        }
        if (!VALID_WORD.test(word)) {
          throw new TypeError(`Invalid word ${JSON.stringify(word)}: only lowercase a-z is allowed`);
        }
      }

      const newRoot = createNode();
      for (const word of words) {
        let node = newRoot;
        for (const char of word) {
          let child = node.children.get(char);
          if (child === undefined) {
            child = createNode();
            node.children.set(char, child);
          }
          node = child;
        }
        node.isEnd = true;
      }
      root = newRoot;
    },

    contains(word: string): boolean {
      return findNode(word)?.isEnd === true;
    },

    startsWith(prefix: string): boolean {
      // The empty string is never part of the dictionary, so it is not a valid prefix either.
      if (prefix === "") return false;
      // Nodes are only created along inserted words and never removed, so every non-root node has a word
      // at or below it: reaching the node means some word starts with the prefix.
      // A prefix with characters outside a-z simply finds no path, like in contains.
      return findNode(prefix) !== undefined;
    },

    search(pattern: string): boolean {
      // The empty string is never part of the dictionary, so the empty pattern never matches.
      if (pattern === "") return false;

      // Depth-first walk over states: `node` is where we are in the trie, `index` is how much of the pattern
      // has been consumed. An explicit stack instead of recursion keeps long words and patterns off the call stack.
      const stack: Array<[node: TrieNode, index: number]> = [[root, 0]];
      // A state's outcome depends only on (node, index), so each state is expanded at most once. Without this,
      // patterns like `*a*a*a…b` would retry every way of splitting a word among the stars (exponential time).
      const visited = new Map<TrieNode, Set<number>>();
      while (stack.length > 0) {
        const [node, index] = stack.pop()!;

        let seen = visited.get(node);
        if (seen === undefined) {
          seen = new Set();
          visited.set(node, seen);
        }
        if (seen.has(index)) continue;
        seen.add(index);

        // The whole pattern is consumed: it matches only if a word ends exactly here.
        if (index === pattern.length) {
          if (node.isEnd) return true;
          continue;
        }

        const char = pattern[index];
        if (char === "*") {
          stack.push([node, index + 1]); // `*` matches zero characters
          for (const child of node.children.values()) stack.push([child, index]); // or one more, staying on `*`
        } else if (char === "?") {
          for (const child of node.children.values()) stack.push([child, index + 1]);
        } else {
          // A character outside a-z has no edge in the trie, so this path simply ends, like in contains.
          const child = node.children.get(char);
          if (child !== undefined) stack.push([child, index + 1]);
        }
      }
      return false;
    },
  };
}
