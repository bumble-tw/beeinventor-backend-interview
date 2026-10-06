## Context

Part A（change `exact-match`）與 Part B（change `prefix-search`）都已封存。`exercise-1-dictionary/src/dictionary.ts` 的 `createDictionary()` 把 Trie 的 root 存在 closure 內，每個 `TrieNode` 有 `children: Map<string, TrieNode>` 與 `isEnd`；`setup` 先驗證、再建新 root、最後替換，節點只在插入單字時沿單字路徑建立、從不刪除，且 `setup` 拒絕 `""`，所以 root 的 `isEnd` 永遠是 `false`。私有輔助函式 `findNode(text)` 以迴圈從 root 逐字元走訪，`contains` 與 `startsWith` 都用它。所有走訪都是迴圈而非遞迴，避免很長的字讓堆疊溢位。

`exercise-1-dictionary/src/cli.ts` 的 `runCommand(dict, line)` 已支援 `setup` / `contains` / `startsWith` / `help` / `exit` / `quit`，`""` token 代表空字串，`HELP` 常數為使用說明。目前 `npm test` 共 71 項測試全數通過（2026-10-05 實測，含 commit `9e927b4` 新增的題目範例測試）。

Part C 要在同一個 Trie 上加 `search(pattern)`：`?` 代表剛好一個字元、`*` 代表零個或多個字元、整字比對，並在命令列提供對應指令。

## Goals / Non-Goals

**Goals:**

- `Dictionary` interface 與 `createDictionary()` 回傳物件新增 `search`，行為符合 `dictionary` spec 的「Wildcard lookup」。
- 多個 `*` 的 pattern 不會造成指數級的工作量。
- `npm run demo` 新增 `search <pattern>` 指令，`help` 列出它，行為符合 `dictionary-cli` spec。
- `contains`、`startsWith`、`setup` 行為不變（既有 71 項測試全數通過）。
- README 補齊 Part C 內容，包含先前留白的 Trade-offs 段與 Complexity 表 `search` 列。

**Non-Goals:**

- 不回傳符合的單字清單或數量（只回傳 boolean）。
- 不支援 `?`、`*` 以外的萬用字元（例如字元集合 `[abc]`），也不支援跳脫字元（字典只有 `a-z`，不需要比對字面上的 `?` 或 `*`）。
- 不為 `search` 另建索引（例如反向 Trie 或後綴索引）來加速 `*d` 這類開頭是 `*` 的 pattern。
- 不改變 `setup` 的驗證規則或 Trie 節點結構。

## Decisions

### Walk the trie with an explicit stack of (node, pattern index) states

`search` 以明確的堆疊（陣列）做深度優先走訪，每個狀態是 `(node, i)`：「已走到 Trie 的 `node`，pattern 已消耗到第 `i` 個字元」。從 `(root, 0)` 開始，取出一個狀態後依 `pattern[i]` 展開：

- `i === pattern.length`：若 `node.isEnd` 為 `true` 就找到符合的字，立即回傳 `true`；否則此路不通。
- `pattern[i] === "?"`：對 `node` 的每個子節點推入 `(child, i + 1)`。
- `pattern[i] === "*"`：推入 `(node, i + 1)`（`*` 符合零個字元），並對每個子節點推入 `(child, i)`（`*` 多吃一個字元、繼續留在 `*`）。
- 其他字元：若 `node.children.get(pattern[i])` 存在就推入 `(child, i + 1)`。

堆疊清空仍沒找到就回傳 `false`。整字比對由「pattern 用完時要求 `isEnd`」保證，所以 `search("ca")` 對 `cat` 回傳 `false`。

替代方案：

- 遞迴回溯：程式較短，但與 Part A、B「不用遞迴，避免長字造成堆疊溢位」的既定做法不一致，`*` 讓遞迴深度最多達「字長 + pattern 長度」。
- 把 pattern 轉成 `RegExp` 後逐字比對所有單字：需要另存單字清單（或從 Trie 還原），每次查詢都要掃過全部 N 個字，也無法利用 Trie 共用前綴來剪枝；README 的 Data structure choice 已說明 Trie 是為了 Part C 能剪枝。

### Memoize visited states so multiple stars stay polynomial

走訪時記錄已處理過的 `(node, i)` 狀態，取出一個已看過的狀態就直接略過。紀錄方式為 `Map<TrieNode, Set<number>>`（以節點物件為鍵、存放已處理過的 pattern 位置），在每次 `search` 呼叫內建立，查詢結束即丟棄。

理由：同一個 `(node, i)` 狀態的結果只取決於 `node` 底下的子樹與 pattern 從 `i` 開始的剩餘部分，重複處理不會有新結果。沒有紀錄時，像 `*a*a*…b` 這類 pattern 對 30 個 `a` 的字，要嘗試把字切給各個 `*` 的所有方式，組合數約為 C(45, 15) ≈ 3.4 × 10¹¹（估算，未實測；spec 的「Many stars do not cause exponential work」scenario 以一秒逾時的測試確認有紀錄時能快速結束）。有紀錄時，狀態總數最多是「Trie 節點數 × (pattern 長度 + 1)」，每個狀態只處理一次。

替代方案：

- 先把連續的 `*` 合併成一個再走訪：能減少部分重複，但 `*a*a*` 這類不連續的 `*` 仍會指數爆炸，不能取代紀錄。合併本身由紀錄間接涵蓋（`**` 的第二個 `*` 狀態只會被處理一次），因此不另做。
- 在 `TrieNode` 上存放紀錄：會改變 Part A 的節點結構，且要在每次查詢前清除，不如每次查詢建立一個 `Map`。

### Reject the empty pattern and rely on the walk for invalid characters

`search` 先判斷 `pattern === ""` 就回傳 `false`，與 `startsWith("")` 相同（空字串在字典裡完全不存在）。事實上即使不判斷，`(root, 0)` 也會因 root 的 `isEnd` 為 `false` 而回傳 `false`；明確判斷讓結果不依賴「`setup` 拒絕 `""`」這個前提，也讓意圖一目了然。

不另做 `/^[a-z?*]+$/` 驗證：Trie 只有 `a-z` 的邊，pattern 中 `a-z`、`?`、`*` 以外的字元在走到它時一定找不到子節點，該路徑就此結束；所有路徑都必須經過這個字元才能把 pattern 用完，所以結果必為 `false`。這與 `contains`、`startsWith` 採同一策略（載入嚴格、查詢寬鬆）。

### Mirror the startsWith command for search in the CLI

`runCommand` 新增 `case "search"`：參數超過一個時輸出 `Usage: search <pattern>`，否則輸出 `String(dict.search(args[0] ?? ""))`。`""` token 已在共用的參數轉換中處理；`?` 與 `*` 是一般字元，CLI 以空白切分、不做任何展開，原樣傳給 `search`。`HELP` 常數新增一行 `search <pattern>` 說明，並註明 `?` 與 `*` 的意義。

## Implementation Contract

**Interface**（`exercise-1-dictionary/src/dictionary.ts`）：

```ts
export interface Dictionary {
  setup(words: string[]): void;
  contains(word: string): boolean;
  startsWith(prefix: string): boolean;
  search(pattern: string): boolean;
}
```

- `search(pattern)`：最近一次成功 `setup` 載入的單字中，有任何一個整字符合 pattern 時回傳 `true`，否則 `false`。`?` 符合剛好一個字元，`*` 符合零個或多個字元。
- `search("")`：一律回傳 `false`。`search("*")`：字典至少有一個單字時回傳 `true`。
- 失敗的 `setup`（丟 `TypeError`）不影響 `search` 結果。
- `contains`、`startsWith`、`setup` 的行為與 Part A、B 完全相同。

**Demo CLI**（`exercise-1-dictionary/src/cli.ts`）：

| 輸入 | `output` | `exit` |
| --- | --- | --- |
| `search p` | `true` 或 `false` | `false` |
| `search` / `search ""` | `false` | `false` |
| `search a b` | `Usage: search <pattern>` | `false` |
| `help` | 使用說明，列出 `setup`、`contains`、`startsWith`、`search`、`help`、`exit` | `false` |

**Failure modes:**

- `search` 對任何字串都不丟錯；含 `a-z`、`?`、`*` 以外字元回傳 `false`。
- `runCommand` 不丟錯；參數數量錯誤輸出 usage 訊息。

**Acceptance criteria:**

- `exercise-1-dictionary/test/dictionary.test.ts` 對 `dictionary` spec「Wildcard lookup」的每個 scenario 與 Example 表格每一列（20 列）至少有一個測試，「Wildcard examples from the interview brief」逐字對應題目 Part C 的 5 個範例；「Many stars do not cause exponential work」測試以 `performance.now()` 量測 `search` 呼叫耗時並斷言小於 1000 ms（不用 `node:test` 的 `timeout` 選項，因為它無法中斷同步執行的走訪）。
- `exercise-1-dictionary/test/cli.test.ts` 對 `dictionary-cli` spec「Search command」每個 scenario 與 Example 表格每一列（9 列）至少有一個測試，「Help lists commands」測試檢查 `search`，且至少一個測試以子行程執行 `src/cli.ts` 並輸入 `search` 指令。
- 在 `exercise-1-dictionary/` 執行 `npm test` 全部通過（含 Part A、B 既有 71 項），`npm run typecheck` 無錯誤。
- `printf 'setup cat car card\nsearch c?r*\nsearch *x*\nexit\n' | npm run demo` 的輸出依序含 `true` 與 `false`。
- `exercise-1-dictionary/README.md`：API 段 `search` 不再標示 planned；Complexity 表 `search` 列不再是 TODO；Trade-offs 段不再是 TODO；Try it 指令表列出 `search`；Tests 段列出 wildcard 與 CLI `search` 的案例。

**Scope boundaries:**

- In scope：`search` 方法（明確堆疊走訪 + 狀態紀錄）、CLI `search` 指令與 `HELP`、對應測試、`exercise-1-dictionary/README.md` 的 Part C 內容與 Trade-offs 段、根目錄 `README.md` 中提到 demo 指令與 Exercise 1 概要的句子補上 `search`。
- Out of scope：`setup` 驗證與 Trie 節點結構的變更、`contains` / `startsWith` 的任何修改、回傳符合單字清單、其他萬用字元語法、新增 runtime 相依套件、Exercise 2。

## Risks / Trade-offs

- [以 `*` 開頭的 pattern（例如 `*d`）無法利用前綴剪枝，最壞要走訪整棵 Trie] → 狀態紀錄保證每個 `(node, i)` 只處理一次，最壞時間為 O(T·M)（T = Trie 節點數，M = pattern 長度）；在 README Trade-offs 段說明，並記錄「若需要可另建反向 Trie 加速後綴查詢」為未採用的方案。
- [狀態紀錄在最壞情況佔用 O(T·M) 額外記憶體] → 紀錄只在單次查詢內存在，查詢結束即釋放；以記憶體換取避免指數時間，在 README Complexity 與 Trade-offs 段說明。
- [「Many stars」測試以耗時小於一秒判斷，若機器極慢可能誤判] → 有紀錄時狀態數最多約 31 × 32 ≈ 1,000 個（估算：30 個 `a` 的字有 31 個節點，pattern 長 31 個字元），遠低於一秒能處理的量；沒有紀錄時估算約 10¹¹ 次嘗試，同步走訪會長時間佔住執行緒、測試無法自行結束，因此實作時以外部 10 秒時限執行此測試，確認沒有紀錄的版本在時限內跑不完。
- [`search` 指令中的 `*` 在使用者從 shell 管線輸入時可能被 shell 展開] → `npm run demo` 的互動模式由程式自己讀取每一行，不經 shell 展開；README 的管線範例以單引號包住 `printf` 的字串，避免展開。
