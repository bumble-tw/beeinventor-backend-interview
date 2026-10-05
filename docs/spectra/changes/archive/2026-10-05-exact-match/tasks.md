## 1. 字典骨架與 Trie 結構

- [x] 1.1 先寫失敗測試：在 `exercise-1-dictionary/test/dictionary.test.ts` 新增「Query before any setup」測試（新建的 `Dictionary` 呼叫 `contains("cat")` 回傳 `false`）；執行 `npm test` 確認因 `src/dictionary.ts` 尚不存在而失敗。
- [x] 1.2 [after: 1.1] 建立 `exercise-1-dictionary/src/dictionary.ts`，named export `Dictionary` 類別，依「Use a Trie as the underlying data structure」與「Store Trie children in a Map keyed by character」定義 Trie 節點（`Map<string, TrieNode>` 子節點 + `isEnd`），新字典的 root 為空節點，`contains` 先回傳 `false`；不可使用 `enum`、`namespace`、constructor parameter properties（type stripping 不支援）。驗證：`npm test` 中 1.1 的測試通過，`npm run typecheck` 無錯誤。

## 2. Load dictionary contents 與 Exact match lookup

- [x] 2.1 [after: 1.2] 先寫失敗測試，涵蓋 spec 中「Load dictionary contents」與「Exact match lookup」的所有 scenario：Words become queryable after setup、Setup replaces previous contents、Duplicate words are harmless、Empty word list yields an empty dictionary、Exact match lookups（Example 表格每一列各一個斷言，含 `"ca"`、`"cards"`、`"Cat"`、`"c?t"` 回傳 `false` 且不丟錯）、Empty string is found when loaded、Empty string is not found when not loaded。驗證：`npm test` 顯示這些測試失敗（尚未實作），且失敗原因是斷言不符而非語法錯誤。
- [x] 2.2 [after: 2.1] 實作 `setup` 插入與 `contains` 逐字元走訪：以迴圈（非遞迴）插入每個單字並在末節點設 `isEnd`；`contains` 走不到節點即回傳 `false`，走完回傳該節點 `isEnd`；依「Treat the empty string as a valid word」讓 `""` 直接設定／讀取 root 的 `isEnd`。驗證：2.1 的全部測試通過，`npm run typecheck` 無錯誤。

## 3. Reject invalid words on setup

- [x] 3.1 [after: 2.2] 先寫失敗測試，涵蓋 spec「Reject invalid words on setup」：Invalid word is rejected（`["cat", "Dog"]` 及 Example 表格 `"Cat"`、`"ca1"`、`"c-t"`、`"ca t"`、`"café"` 各一個 `assert.throws(..., TypeError)`），以及 Failed setup keeps previous contents（先 `setup(["cat"])`，再 `setup(["dog", "Bad"])` 丟錯後 `contains("cat")` 為 `true`、`contains("dog")` 為 `false`）。驗證：`npm test` 顯示這些新測試失敗。
- [x] 3.2 [after: 3.1] 依「Validate words with a lowercase a-z check in setup」以 `/^[a-z]*$/` 驗證所有單字，不符時丟出訊息含該單字的 `TypeError`；依「Make setup atomic by building a new root before swapping」先驗證全部單字、再建新 root 插入、最後才替換 `this.root`。驗證：3.1 與先前所有測試通過，`npm run typecheck` 無錯誤。

## 4. 文件

- [x] 4.1 [after: 3.2] 更新 `exercise-1-dictionary/README.md` 的 Part A 內容：Assumptions 移除 TODO，寫明空字串為合法單字、空字典對任何查詢回傳 `false`、`setup` 遇非 `a-z` 丟 `TypeError` 且保留原內容、`contains` 遇非 `a-z` 回傳 `false`；Data structure choice 說明採用 Trie（Map 子節點）及捨棄 `Set` / 26 格陣列的理由；Complexity 表填入 `setup`（時間 O(N·L)、空間 O(N·L)，N 為單字數、L 為平均長度）與 `contains`（時間 O(L)、額外空間 O(1)）；Tests 段列出已覆蓋的案例。`startsWith` / `search` 列與 Trade-offs 保留給後續 Part。驗證：人工檢視 README 中 Part A 相關段落不再含 TODO，且內容與 `design.md` 的 Decisions 一致。

## 5. 介面改為工廠函式 createDictionary()

> 變更說明：任務 1.2–3.2 以 `class Dictionary` 完成實作，屬已完成的歷史紀錄，保持不動。依 design「Expose a factory function instead of a class」（Supersedes 原 class 介面），以下任務以「先新增 → 遷移測試 → 移除舊寫法」的順序改為 `createDictionary()`；spec 行為不變，現有測試作為回歸保護，每一步結束時 `npm test` 都必須全數通過。

- [x] 5.1 [after: 4.1] 在 `exercise-1-dictionary/src/dictionary.ts` 新增 named export `createDictionary()`，暫時回傳 `new Dictionary()`，`class Dictionary` 保留不動（先並存）。驗證：`npm test` 既有 21 項測試全部通過，`npm run typecheck` 無錯誤。
- [x] 5.2 [after: 5.1] 將 `exercise-1-dictionary/test/dictionary.test.ts` 中所有建立字典的地方（`dictionaryWith` 輔助函式與各測試裡的 `new Dictionary()`）改為 `createDictionary()`，import 改為只匯入 `createDictionary`（輔助函式的回傳型別改用 `import type { Dictionary }`）；並新增測試「Separate dictionaries are independent」：建立 `a`、`b` 兩本字典，`a.setup(["cat"])`、`b.setup(["dog"])` 後，`a.contains("dog")` 與 `b.contains("cat")` 皆為 `false`，`a.contains("cat")` 與 `b.contains("dog")` 皆為 `true`。此行為已存在，採回歸測試流程：新測試須先通過，再暫時把 `createDictionary` 改成每次回傳同一個共用實例，確認新測試因此失敗後立刻還原。驗證：`npm test` 22 項全部通過，`npm run typecheck` 無錯誤，且已記錄共用實例下新測試失敗的結果。
- [x] 5.3 [after: 5.2] 依 design「Expose a factory function instead of a class」與 Implementation Contract，把 `exercise-1-dictionary/src/dictionary.ts` 改寫為：匯出 `interface Dictionary`（只含 `setup` / `contains` 簽名）與 `createDictionary()`；Trie root 為 `createDictionary` 內的區域變數，由回傳物件的方法以 closure 存取；`setup` 仍是先驗證全部單字、建新 root、最後才替換 `root`；移除 `export class Dictionary`。`TrieNode` 維持模組內部、不匯出。驗證：`npm test` 22 項全部通過，`npm run typecheck` 無錯誤，且 `grep -rn "class Dictionary\|new Dictionary" exercise-1-dictionary/src exercise-1-dictionary/test` 沒有任何結果。
- [x] 5.4 [after: 5.3] 更新 `exercise-1-dictionary/README.md`：API 段補上 `createDictionary()` 用法（先 `const dict = createDictionary()`，再呼叫 `dict.setup` / `dict.contains`）；Data structure choice 補一句說明採用工廠函式加 closure 封裝 root，以及不採用模組層級函式（全域狀態）的理由；Tests 段的案例清單加入「兩本字典互不影響」。驗證：人工檢視 README 不再出現 `class Dictionary` 或 `new Dictionary`，且 API 段的範例與 design 的 Implementation Contract 一致。

## 6. 互動式示範命令列 npm run demo

> 變更說明：依使用者要求，在 Part A 同一個 change 中加入 `dictionary-cli` capability。實作依 design「Provide the demo as a line-based command interpreter」與 Implementation Contract 的 Demo CLI 表格。

- [x] 6.1 [after: 5.4] 先寫失敗測試：新增 `exercise-1-dictionary/test/cli.test.ts`，對 `runCommand` 涵蓋 spec「Setup command」與「Contains command」的所有 scenario：Setup loads words、Setup with an invalid word keeps previous contents、Setup with no words empties the dictionary、Contains prints lookup results（Example 表格每一列各一個斷言）、Empty string token。同時在 `exercise-1-dictionary/src/cli.ts` 建立只有簽名的 `runCommand`（回傳 `{ output: "", exit: false }`）與 `CommandResult` interface，讓測試失敗原因是斷言不符而非找不到模組。驗證：`npm test` 顯示這些新測試因斷言不符而失敗。
- [x] 6.2 [after: 6.1] 在 `runCommand` 實作以空白切分、`""` token 轉為空字串、`setup`（輸出 `Loaded N word(s).`，`TypeError` 轉為 `Error: <訊息>`）、`contains`（輸出 `true` / `false`，超過一個參數輸出 `Usage: contains <word>`）。驗證：6.1 的測試全部通過，`npm run typecheck` 無錯誤。
- [x] 6.3 [after: 6.2] 先寫失敗測試，涵蓋 spec「Help and unknown commands」的 Help lists commands、Unknown command，「Interactive demo session」的 Blank line is ignored，以及 `exit` / `quit` 回傳 `exit: true`。驗證：`npm test` 顯示這些新測試因斷言不符而失敗。
- [x] 6.4 [after: 6.3] 在 `runCommand` 實作 `help`（列出 `setup`、`contains`、`help`、`exit`）、只有空白的行輸出空字串、`exit` / `quit` 回傳 `exit: true`、其他指令輸出 `Unknown command "<name>". Type "help" for usage.`。驗證：全部測試通過，`npm run typecheck` 無錯誤。
- [x] 6.5 [after: 6.4] 先寫失敗測試：在 `exercise-1-dictionary/test/cli.test.ts` 以 `node:child_process` 的 `spawnSync(process.execPath, ["src/cli.ts"], { input })` 實際執行命令列，涵蓋 spec「Interactive demo session」的 Piped commands run in order（輸出依序含 `Loaded 3 word(s).`、`true`、`false`，exit code 0）與 Session ends when input ends（輸出含 `true`，exit code 0）。驗證：`npm test` 顯示這兩個測試失敗（尚無主程式，輸出不含預期文字）。
- [x] 6.6 [after: 6.5] 在 `exercise-1-dictionary/src/cli.ts` 加入僅在 `import.meta.main` 為 `true` 時啟動的主程式：先印使用說明，用 `node:readline` 逐行讀 stdin 交給 `runCommand`、印出非空的 `output`，`exit` 為 `true` 或輸入結束時結束；stdin 為終端機時才顯示 `> ` 提示字元。在 `exercise-1-dictionary/package.json` 新增 `"demo": "node src/cli.ts"`。驗證：全部測試通過，`npm run typecheck` 無錯誤，且 `printf 'setup cat car card\ncontains cat\nexit\n' | npm run demo` 的輸出含 `Loaded 3 word(s).` 與 `true`。
- [x] 6.7 [after: 6.6] 更新文件：`exercise-1-dictionary/README.md` 新增試用段落，說明 `npm run demo` 與一段範例操作（`setup`、`contains`、錯誤輸入、`exit`），Tests 段加入命令列測試的案例；根目錄 `README.md` 的 How to run 加入 `npm run demo`。驗證：人工檢視兩份 README，範例中的指令與輸出和 design 的 Demo CLI 表格一致。

## 7. 空字串不再是合法單字

> 變更說明：依使用者決定「空字串在字典裡完全不存在」，design「Reject the empty string as a word」取代「Treat the empty string as a valid word」。任務 2.1、2.2、6.1、6.2 依舊規則完成（`""` 可載入、`contains("")` 可為 `true`），屬已完成的歷史紀錄，保持不動；以下任務把測試與實作改為新規則。

- [x] 7.1 [after: 6.7] 先寫失敗測試（改寫既有測試以符合新 spec）：在 `exercise-1-dictionary/test/dictionary.test.ts` 把「Empty string is found when loaded」改為 spec 的「Setup with the empty string keeps previous contents」（先 `setup(["a"])`，`setup(["", "b"])` 丟 `TypeError` 後 `contains("a")` 為 `true`、`contains("b")` 與 `contains("")` 為 `false`），把「Empty string is not found when not loaded」改名為「Empty string is never found」，並在「Example: invalid inputs」表格加入 `[""]` 與 `["cat", ""]` 兩列；在 `exercise-1-dictionary/test/cli.test.ts` 把「Empty string token」測試改為 spec 新情境（`setup cat`、`setup "" a`、`contains ""`、`contains cat` 依序輸出 `Loaded 1 word(s).`、`Error: Invalid word "": empty words are not allowed`、`false`、`true`），並把「Contains prints lookup results」表格中兩列空字串的說明改為 `empty string, never a word`。驗證：`npm test` 中新增的兩列 invalid inputs、「Setup with the empty string keeps previous contents」與 CLI「Empty string token」因斷言不符而失敗（目前 `""` 仍被接受）。
- [x] 7.2 [after: 7.1] 依 design「Reject the empty string as a word」修改 `exercise-1-dictionary/src/dictionary.ts`：驗證改為 `/^[a-z]+$/`，`""` 的 `TypeError` 訊息為 `Invalid word "": empty words are not allowed`，其他不合法單字訊息不變；先驗證全部單字、再建新 root 的流程不變；`contains` 不需修改。驗證：全部測試通過，`npm run typecheck` 無錯誤。
- [x] 7.3 [after: 7.2] 更新說明文字：`exercise-1-dictionary/src/cli.ts` 的 `HELP` 最後一行改為說明 `""` 代表空字串、而空字串永遠不是單字（例如 `setup ""` 會被拒絕、`contains ""` 輸出 `false`）；`exercise-1-dictionary/README.md` 的 Try it 段同步改寫 `""` 的說明，Assumptions 改為空字串不是合法單字（`setup` 丟 `TypeError`、`contains("")` 一律 `false`），Data structure choice 移除「空字串插入時設定 root 的 `isEnd`」等過時描述（若有），Tests 段的 Invalid words 與 Edge cases 改為新案例。驗證：全部測試通過；人工檢視 README 不再出現「`""` is a valid word」或「`""` is found only when it was loaded」，且 `printf 'setup "" a\ncontains ""\nexit\n' | npm run demo` 輸出含 `Error: Invalid word "": empty words are not allowed` 與 `false`。
