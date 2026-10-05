## Why

Exercise 1 要求實作一個記憶體內字典（in-memory dictionary），分三個階段完成：Part A exact match、Part B prefix search、Part C wildcard search。目前 `exercise-1-dictionary/src/` 是空的，需要先完成 Part A：能載入一組單字並判斷某個單字是否完整存在，這也是 Part B / Part C 共用的資料結構基礎。

## What Changes

- 新增工廠函式 `createDictionary()`，回傳一個 `Dictionary` 物件（TypeScript interface），提供 `setup(words: string[]): void` 與 `contains(word: string): boolean`；每次呼叫都建立彼此獨立的字典。
- `setup` 載入或取代字典內容；重複單字不影響結果；遇到含非 `a-z` 字元的單字時丟出 `TypeError`，且不改動原本內容。
- `contains` 判斷單字是否完整存在（不是前綴命中）；傳入含非 `a-z` 字元的字串時回傳 `false`，不丟錯。
- 空字串 `""` 在字典裡完全不存在：`setup` 遇到 `""` 時丟出 `TypeError`（訊息 `Invalid word "": empty words are not allowed`）且不改動原本內容；`contains("")` 一律回傳 `false`。
- 底層使用 Trie，讓 Part B / Part C 能直接沿用。
- 新增互動式示範命令列：在 `exercise-1-dictionary/` 執行 `npm run demo` 後，可直接輸入 `setup cat car card`、`contains cat` 等指令操作字典並看到結果，不需要自己撰寫程式或 import 任何函式；輸入錯誤時顯示錯誤訊息並繼續等待下一個指令。
- 新增 Node 內建測試執行器（`node --test`）的測試檔，涵蓋題目範例與邊界情況。
- 更新 `exercise-1-dictionary/README.md` 中 Part A 相關的假設、資料結構選擇與複雜度，並說明 `npm run demo` 的用法。

## Non-Goals (optional)

（記錄於 design.md）

## Capabilities

### New Capabilities

- `dictionary`: 記憶體內字典的載入（setup）與完整單字查詢（exact match）；後續 Part B / Part C 會在此 capability 上新增 prefix 與 wildcard 查詢需求。

- `dictionary-cli`: 以 `npm run demo` 啟動的互動式命令列，讓使用者直接輸入 `setup` / `contains` 指令操作字典；Part B / Part C 會在此 capability 上新增對應指令。

### Modified Capabilities

（無）

## Impact

- 新增程式碼：exercise-1-dictionary/src/dictionary.ts、exercise-1-dictionary/src/cli.ts
- 新增測試：exercise-1-dictionary/test/dictionary.test.ts、exercise-1-dictionary/test/cli.test.ts
- 更新設定：exercise-1-dictionary/package.json（新增 `demo` script）
- 更新文件：README.md（How to run 加入 `npm run demo`）、exercise-1-dictionary/README.md（`npm run demo` 用法、Assumptions、Data structure choice、Complexity 中 `setup` / `contains` 列，以及 `createDictionary()` 的使用方式）
- 相依套件：無新增；runtime 僅用標準函式庫
