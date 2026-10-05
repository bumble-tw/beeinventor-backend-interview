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
}

export function createDictionary(): Dictionary {
  let root = createNode();

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
      let node: TrieNode | undefined = root;
      for (const char of word) {
        node = node.children.get(char);
        if (node === undefined) return false;
      }
      return node.isEnd;
    },
  };
}
