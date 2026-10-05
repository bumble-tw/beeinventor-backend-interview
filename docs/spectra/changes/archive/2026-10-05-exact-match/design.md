## Context

Exercise 1 要實作記憶體內字典，分三階段：Part A exact match（`contains`）、Part B prefix search（`startsWith`）、Part C wildcard search（`search`，`?` 代表一個字元、`*` 代表零或多個字元）。目前 `exercise-1-dictionary/src/` 與 `test/` 只有 `.gitkeep`，`package.json` 已設定 `npm test`（`node --test "test/**/*.test.ts"`）與 `npm run typecheck`（`tsc --noEmit`），`tsconfig.json` 啟用 `strict`、`allowImportingTsExtensions`、`erasableSyntaxOnly`、`verbatimModuleSyntax`。

限制：Node.js 24 直接執行 `.ts`（type stripping），因此不能使用需要轉譯的語法（`enum`、`namespace`、constructor parameter properties）；runtime 只能用標準函式庫。

本 change 只做 Part A，但資料結構要讓 Part B / Part C 能直接延伸。

## Goals / Non-Goals

**Goals:**

- 提供工廠函式 `createDictionary()`，回傳的 `Dictionary` 物件具備 `setup` 與 `contains`，行為符合 `dictionary` spec。
- 底層採用 Trie，讓 Part B / Part C 在同一結構上新增查詢方法，不需重構。
- `setup` 具備原子性：輸入有錯時不破壞既有內容。
- 測試涵蓋 spec 中每一個 scenario。
- 提供 `npm run demo` 互動式命令列，讓使用者直接輸入 `setup` / `contains` 指令試用字典，行為符合 `dictionary-cli` spec。
- 更新 `exercise-1-dictionary/README.md` 中與 Part A 相關的段落。

**Non-Goals:**

- 不實作 `startsWith`（Part B）與 `search`（Part C）。
- 不支援刪除單字或增量新增單字（只有 `setup` 整批取代）。
- 不處理非字串的執行期輸入（例如 `setup([123])`）；型別由 TypeScript 保證。
- 不做持久化、序列化或並行存取。
- 命令列不支援引號包住含空白的單字、指令歷史以外的行編輯功能、或從檔案載入單字；單字本身不可含空白，以空白切分即可。
- 不採用 `Set<string>` 作為主要結構（見 Decisions）。

## Decisions

### Expose a factory function instead of a class

對外介面為 `createDictionary(): Dictionary`。`Dictionary` 是只含方法簽名的 TypeScript interface；Trie 的 root 存在 `createDictionary` 內的區域變數，由回傳物件的 `setup` / `contains` 以 closure 存取，外部無法直接讀寫。每次呼叫 `createDictionary()` 都建立新的 root，因此不同字典互不影響。

**Supersedes**：原先「以 `export class Dictionary` 作為對外介面」的寫法（已於任務 1.2–3.2 以 class 實作）。依使用者決定改為工廠函式；`dictionary` spec 只規範 `setup` / `contains` 的行為，未規範 class，因此 spec 不需修改。

替代方案：

- 維持 `class Dictionary`：TypeScript 中最常見的封裝方式，行為完全相同；屬寫法偏好，使用者選擇函式寫法。
- 模組層級函式（直接 `export function setup` / `contains`，共用一個模組變數）：最貼近 README 列出的裸函式簽名，但整個程式只有一份字典（全域狀態），測試之間會互相污染，也無法同時存在兩本字典，因此不採用。

### Use a Trie as the underlying data structure

每個節點保存子節點對應表與 `isEnd` 旗標（`TrieNode` 為模組內部的純物件型別，由 `createNode()` 建立，不對外匯出）。`contains` 從 root 逐字元往下走，走完後回傳該節點的 `isEnd`。

替代方案：

- `Set<string>`：`contains` 平均 O(L)（雜湊需讀完整字串），實作最簡單；但 Part B 的 prefix 查詢需要掃描全部單字或另建索引，Part C 的 wildcard 也無法剪枝。
- `Set` + Trie 並存：exact match 稍快，但記憶體加倍、兩份資料需同步，對本題沒有必要。

選 Trie 是因為三個 Part 都能在同一結構上以 O(L) 或可剪枝的方式完成，Part A 的成本與 `Set` 同階。

### Store Trie children in a Map keyed by character

子節點使用 `Map<string, TrieNode>`。

替代方案：長度 26 的陣列（以 `charCode - 97` 為索引）。陣列查找略快，但每個節點固定配置 26 格，稀疏時浪費記憶體；`Map` 只存實際存在的分支，可讀性也較好，Part C 走訪所有子節點時直接迭代 `Map` 即可。效能差異在本題規模下不重要（估計，未量測）。

### Validate words with a lowercase a-z check in setup

`setup` 用 `/^[a-z]+$/` 檢查每個單字（至少一個字母，見「Reject the empty string as a word」）；任一單字不符就丟出 `TypeError`，訊息包含該單字。`contains` 不丟錯：遇到不存在於 Trie 的字元時自然走不到節點而回傳 `false`，因此不需另外驗證。

替代方案：`contains` 也丟錯（契約最嚴格，但查詢端需處理例外）；完全不驗證（最寬鬆，但髒資料無法及早發現）。採「載入嚴格、查詢寬鬆」：資料錯誤在載入時就暴露，查詢則永遠安全。

### Make setup atomic by building a new root before swapping

`setup` 先驗證全部單字，再建立新的 root 並插入所有單字，最後才把 closure 內的 `root` 變數指向新 root。驗證失敗時直接丟錯，`root` 不變。

替代方案：先清空再逐字插入，遇錯中止 — 會留下半套內容，違反 spec 的「Failed setup keeps previous contents」。

### Treat the empty string as a valid word

（已被「Reject the empty string as a word」取代；以下為原決策，保留作為紀錄。）

`""` 通過 `/^[a-z]*$/` 驗證；插入時不走任何邊，直接把 root 的 `isEnd` 設為 `true`。`contains("")` 回傳 root 的 `isEnd`。這讓空字串與一般單字共用同一套邏輯，不需特例。

### Reject the empty string as a word

**Supersedes**: exact-match / Treat the empty string as a valid word

依使用者決定「空字串在字典裡完全不存在」：驗證改為 `/^[a-z]+$/`，`setup` 遇到 `""` 丟出 `TypeError`，訊息為 `Invalid word "": empty words are not allowed`（其他不合法單字維持 `Invalid word "<word>": only lowercase a-z is allowed`，因為對空字串說「只能用 a-z」無法說明問題）。與其他不合法單字相同，整批拒絕、字典保留呼叫前內容。由於 root 的 `isEnd` 永遠不會被設為 `true`，`contains("")` 走訪後回傳 root 的 `isEnd`，自然一律為 `false`，`contains` 不需要改程式。

替代方案：

- 維持 `""` 為合法單字（原決策）：多一個只在空字串成立的邊界情況，Part B / Part C 的空 prefix、`*` 比對都要額外考慮。
- `setup` 自動略過 `""`：較寬鬆（例如以換行切分檔案時最後的空行），但「傳入 N 個字、字典只有 N-1 個」令人困惑，且與拒絕 `"Cat"` 的做法不一致。

命令列的 `""` token 保留：讓使用者能在 `npm run demo` 試到「`setup ""` 被拒絕」與「`contains ""` 為 `false`」。

### Provide the demo as a line-based command interpreter

`exercise-1-dictionary/src/cli.ts` 分成兩層：

- `runCommand(dict, line)`：純函式，解析一行輸入、操作傳入的字典，回傳 `{ output, exit }`（`output` 為要印出的文字，空字串代表不印；`exit` 為是否結束）。不讀寫 stdin/stdout，方便單元測試。
- 主程式：僅在 `import.meta.main` 為 `true`（檔案被直接執行，而非被測試 import）時啟動。用 `node:readline` 逐行讀 stdin，每行交給 `runCommand` 並印出結果；遇到 `exit` / `quit` 或輸入結束時以 exit code 0 結束。stdin 是終端機時才顯示 `> ` 提示字元，管線輸入時不顯示，讓輸出保持乾淨。

`package.json` 新增 `"demo": "node src/cli.ts"`。

替代方案：

- 在 Node REPL 預先載入字典（`node -i` 或 `repl.start()` 並注入 `dict`）：使用者仍需輸入 `dict.setup(["cat"])` 這種 JavaScript 語法，不符合「直接在 CLI 執行 setup / contains」的需求。
- 一次性參數模式（`npm run demo -- setup cat contains cat`）：每次執行都是新字典，無法連續操作，也難以表達多個指令的順序。
- 固定範例腳本（只印預設查詢結果）：無法讓使用者自己輸入。

指令以空白切分；token `""` 代表空字串，讓 spec 中空字串的情境也能在命令列操作。

## Implementation Contract

**Interface**（`exercise-1-dictionary/src/dictionary.ts`，ES module named export）：

```ts
export interface Dictionary {
  setup(words: string[]): void;
  contains(word: string): boolean;
}

export function createDictionary(): Dictionary;
```

- `createDictionary()` 回傳的新字典為空字典：`contains` 對任何輸入回傳 `false`。
- 兩次呼叫 `createDictionary()` 得到的字典彼此獨立：對其中一個 `setup` 不影響另一個的 `contains` 結果。
- 模組不再匯出 `class Dictionary`（`Dictionary` 只作為型別存在）。
- `setup(words)`：全部單字皆符合 `/^[a-z]+$/`（非空、只含 `a-z`）時，以這批單字取代全部內容；重複單字不影響結果。
- `contains(word)`：只有 `word` 是最近一次成功 `setup` 載入的單字時回傳 `true`；前綴或延伸字都回傳 `false`；`contains("")` 一律回傳 `false`。

**Demo CLI**（`exercise-1-dictionary/src/cli.ts`）：

```ts
export interface CommandResult {
  output: string; // 要印出的文字；空字串代表不印
  exit: boolean;  // true 代表結束 session
}

export function runCommand(dict: Dictionary, line: string): CommandResult;
```

| 輸入 | `output` | `exit` |
| --- | --- | --- |
| `setup w1 w2 ...` | `Loaded N word(s).`（N 為單字 token 數） | `false` |
| `setup` 遇不合法單字 | `Error: ` + `TypeError` 訊息；字典不變 | `false` |
| `contains w` / `contains` / `contains ""` | `true` 或 `false` | `false` |
| `contains a b` | `Usage: contains <word>` | `false` |
| `help` | 使用說明（列出 `setup`、`contains`、`help`、`exit`） | `false` |
| 只有空白的行 | `""` | `false` |
| `exit` / `quit` | `""` | `true` |
| 其他指令 `x` | `Unknown command "x". Type "help" for usage.` | `false` |

啟動時先印一次使用說明。`runCommand` 本身不丟錯：`setup` 的 `TypeError` 被轉為 `Error: ...` 輸出。

**Failure modes:**

- `setup` 遇到任一不合法單字（含 `""`）→ 丟出 `TypeError`（訊息含該單字；`""` 的訊息為 `Invalid word "": empty words are not allowed`），字典內容維持呼叫前狀態。
- `contains` 對任何字串都不丟錯；含非 `a-z` 字元的字串回傳 `false`。

**Acceptance criteria:**

- `exercise-1-dictionary/test/dictionary.test.ts` 對 `dictionary` spec 的每個 scenario（含 Example 表格的每一列）至少有一個對應測試。
- `exercise-1-dictionary/test/cli.test.ts` 對 `dictionary-cli` spec 的每個 scenario（含 Example 表格每一列）至少有一個對應測試，其中至少一個測試以子行程實際執行 `node src/cli.ts` 並以管線輸入指令。
- 在 `exercise-1-dictionary/` 執行 `npm test` 全部通過。
- 在 `exercise-1-dictionary/` 執行 `npm run typecheck` 無錯誤。
- `exercise-1-dictionary/test/dictionary.test.ts` 只透過 `createDictionary()` 建立字典，並有一個測試確認兩本字典互不影響。
- `exercise-1-dictionary/README.md` 的 Assumptions 不再有空字串 / 空字典 / 非法字元的 TODO；Data structure choice 說明 Trie 與替代方案；Complexity 表的 `setup` 與 `contains` 列已填寫。

**Scope boundaries:**

- In scope：`createDictionary()` 工廠函式與 `Dictionary` interface 的 `setup` / `contains`、`npm run demo` 互動式命令列（`setup` / `contains` / `help` / `exit` 指令）、Trie 節點結構、對應測試、README 的 Part A 段落。
- Out of scope：`startsWith`、`search`（含其命令列指令）、README 中 `startsWith` / `search` 的複雜度列與 Trade-offs 段落（留給 Part B / C），任何 runtime 相依套件。

## Risks / Trade-offs

- [命令列以空白切分，無法輸入含空白的單字] → 合法單字只有 `a-z`，本來就不含空白；含空白的輸入會被切成多個 token，由 `setup` 的驗證或 `contains` 的參數數量檢查處理。

- [Trie 對大量長單字的記憶體用量高於 `Set`] → 本題為面試規模的記憶體字典；此取捨留待 Part C 完成後於 README Trade-offs 段一併整理（本 change 不寫 Trade-offs），Part B / C 受益於此結構。
- [`Map` 子節點比固定陣列多一些常數開銷] → 可讀性與稀疏節點的記憶體優先；若日後量測顯示瓶頸再改為陣列，介面不受影響。
- [`setup` 先建新 Trie 再交換，載入期間短暫保有兩份資料] → 換取原子性；舊 root 交換後即可被 GC 回收。
- [遞迴插入/查詢可能在極長單字時爆 stack] → 一律用迴圈實作走訪，不用遞迴。
