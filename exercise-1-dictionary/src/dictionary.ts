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
  };
}
