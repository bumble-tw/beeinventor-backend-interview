## Context

Part A（change `exact-match`，已封存）完成了 `exercise-1-dictionary/src/dictionary.ts` 的 `createDictionary()`：Trie 的 root 存在 closure 內，每個 `TrieNode` 有 `children: Map<string, TrieNode>` 與 `isEnd`；`setup` 先驗證、再建新 root、最後替換，所以 Trie 裡的節點只會因插入單字而產生，且不會被刪除。`contains` 以迴圈從 root 逐字元走訪，走不到回傳 `false`，走完回傳該節點 `isEnd`。

`exercise-1-dictionary/src/cli.ts` 的 `runCommand(dict, line)` 已支援 `setup` / `contains` / `help` / `exit`，`""` token 代表空字串，`HELP` 常數為使用說明。

Part B 要在同一個 Trie 上加 `startsWith(prefix)`，並在命令列提供對應指令。

## Goals / Non-Goals

**Goals:**

- `Dictionary` interface 與 `createDictionary()` 回傳物件新增 `startsWith`，行為符合 `dictionary` spec 的「Prefix lookup」。
- `npm run demo` 新增 `startsWith <prefix>` 指令，`help` 列出它，行為符合 `dictionary-cli` spec。
- `contains` 與 `startsWith` 共用同一段走訪邏輯，`contains` 行為不變（既有測試全數通過）。
- 更新 README 的 API、Complexity、Tests、Try it 段落。

**Non-Goals:**

- 不實作 Part C 的 `search`（wildcard）。
- 不回傳符合 prefix 的單字清單或數量（只回傳 boolean）。
- 不在節點上額外儲存「底下有幾個單字」等計數。
- 不調整 README 的 Trade-offs 段（留給 Part C 完成後一次整理）。

## Decisions

### Share one trie walk between contains and startsWith

在 `createDictionary` 內新增私有輔助函式 `findNode(text: string): TrieNode | undefined`：從 root 逐字元走訪，任一字元找不到子節點就回傳 `undefined`，走完回傳最後的節點（`text` 為 `""` 時回傳 root）。`contains` 改為 `findNode(word)?.isEnd === true`；`startsWith` 以 `findNode(prefix)` 取得節點後判斷（見下一個決策）。

替代方案：在 `startsWith` 裡複製一份迴圈。程式較直白，但兩份走訪邏輯日後容易不一致，而 Part C 也需要從某個節點開始走訪。共用輔助函式只多一層呼叫。

### Reject the empty prefix, otherwise match when the walk succeeds

`startsWith` 先判斷 `prefix === ""` 就回傳 `false`；否則回傳 `findNode(prefix) !== undefined`。

依使用者決定「空字串在字典裡完全不存在」：空 prefix 不算有效查詢，不論字典內容一律為 `false`。此決策取代本 change 先前的草案「Decide a prefix match by whether the reached node holds any word」（空 prefix 在非空字典回傳 `true`），該草案未曾實作。

理由：Trie 的節點只會在插入單字時沿著單字路徑建立，所以除了 root 以外，走得到的節點底下（含自己）一定至少有一個單字；排除 `""` 之後，`findNode` 回傳的永遠不是 root，「走得到」就等於「有單字以此開頭」，不需要再看 `isEnd` 或子節點數量。`""` 的判斷放在最前面，也讓結果與 Part A 是否允許載入 `""` 無關。

替代方案：

- 只回傳 `findNode(prefix) !== undefined`：`""` 會走到 root 而回傳 `true`，違反使用者決定。
- 以 `node.isEnd || node.children.size > 0` 判斷（先前草案）：會讓非空字典的 `startsWith("")` 回傳 `true`，違反使用者決定。
- 另外維護單字數量計數：需要在 `setup` 同步更新，增加狀態卻沒有額外好處。

### Rely on the trie walk for invalid prefixes

`startsWith` 不做 `/^[a-z]*$/` 驗證：Trie 裡只有 `a-z` 的邊，含其他字元的 prefix 一定在某一步找不到子節點而回傳 `false`。這與 Part A 的 `contains` 採同一策略（載入嚴格、查詢寬鬆）。

### Mirror the contains command for startsWith in the CLI

`runCommand` 新增 `case "startsWith"`：參數超過一個時輸出 `Usage: startsWith <prefix>`，否則輸出 `String(dict.startsWith(args[0] ?? ""))`。`""` token 已在共用的參數轉換中處理。`HELP` 常數新增一行 `startsWith <prefix>` 說明。指令名稱與方法名稱一致（區分大小寫），與既有的 `contains` 相同。

## Implementation Contract

**Interface**（`exercise-1-dictionary/src/dictionary.ts`）：

```ts
export interface Dictionary {
  setup(words: string[]): void;
  contains(word: string): boolean;
  startsWith(prefix: string): boolean;
}
```

- `startsWith(prefix)`：最近一次成功 `setup` 載入的單字中有任何一個以 `prefix` 開頭（含完全相等）時回傳 `true`，否則 `false`。
- `startsWith("")`：不論字典內容一律回傳 `false`。
- 失敗的 `setup`（丟 `TypeError`）不影響 `startsWith` 結果。
- `contains` 的行為與 Part A 完全相同。

**Demo CLI**（`exercise-1-dictionary/src/cli.ts`）：

| 輸入 | `output` | `exit` |
| --- | --- | --- |
| `startsWith p` | `true` 或 `false` | `false` |
| `startsWith` / `startsWith ""` | `false` | `false` |
| `startsWith a b` | `Usage: startsWith <prefix>` | `false` |
| `help` | 使用說明，列出 `setup`、`contains`、`startsWith`、`help`、`exit` | `false` |

**Failure modes:**

- `startsWith` 對任何字串都不丟錯；含非 `a-z` 字元回傳 `false`。
- `runCommand` 不丟錯；參數數量錯誤輸出 usage 訊息。

**Acceptance criteria:**

- `exercise-1-dictionary/test/dictionary.test.ts` 對 `dictionary` spec「Prefix lookup」的每個 scenario 與 Example 表格每一列至少有一個測試。
- `exercise-1-dictionary/test/cli.test.ts` 對 `dictionary-cli` spec「StartsWith command」每個 scenario 與 Example 表格每一列至少有一個測試，「Help lists commands」測試檢查 `startsWith`，且至少一個測試以子行程執行 `src/cli.ts` 並輸入 `startsWith` 指令。
- 在 `exercise-1-dictionary/` 執行 `npm test` 全部通過（含 Part A 既有測試），`npm run typecheck` 無錯誤。
- `printf 'setup cat car card\nstartsWith ca\nstartsWith x\nexit\n' | npm run demo` 的輸出依序含 `true` 與 `false`。
- `exercise-1-dictionary/README.md`：API 段的 `startsWith` 不再標示 planned；Complexity 表 `startsWith` 列為時間 O(P)、額外空間 O(1)（P 為 prefix 長度）；Try it 的指令表列出 `startsWith`；Tests 段列出 prefix 測試案例。

**Scope boundaries:**

- In scope：`startsWith` 方法與 `findNode` 共用走訪、`contains` 改用 `findNode`、CLI `startsWith` 指令與 `HELP`、對應測試、README 的 Part B 內容。
- Out of scope：`search`（Part C）及其 CLI 指令、README Trade-offs 段、`setup` 與驗證邏輯的任何變更、新增 runtime 相依套件。

## Risks / Trade-offs

- [`contains` 改用 `findNode` 屬於重構，可能意外改變 Part A 行為] → Part A 的既有測試（含 `""`、前綴、延伸字、非法字元等案例）作為回歸保護，重構前後都必須全數通過。
- [「非 root 節點底下必有單字」依賴節點只在插入時建立、從不刪除] → 目前沒有刪除單字的功能（Part A 的 Non-Goal）；若日後加入刪除，必須同時清除空節點，或改用計數判斷。此限制記錄在 `startsWith` 的程式註解中。
- [`startsWith` 指令名稱有大寫字母，使用者可能輸入 `startswith`] → 會得到 `Unknown command "startswith"` 提示並可用 `help` 查看正確名稱；與方法名稱一致比自訂別名更好對照題目。
