## Why

Exercise 1 的 Part B 要求 prefix search：判斷字典裡是否有任何單字以給定的開頭（prefix）開始。Part A 已完成 `createDictionary()`（Trie 結構）與 `npm run demo` 命令列，Part B 在同一個 Trie 上新增查詢，並讓使用者能在命令列直接試用。

## What Changes

- `Dictionary` interface 新增 `startsWith(prefix: string): boolean`：只要最近一次成功 `setup` 載入的單字中，有任何一個以 `prefix` 開頭就回傳 `true`，否則回傳 `false`。
- 空字串在字典裡完全不存在：`startsWith("")` 不論字典內容一律回傳 `false`。這與 Part A 一致：`setup` 拒絕 `""`、`contains("")` 一律回傳 `false`。
- `startsWith` 對任何字串都不丟錯；含非 `a-z` 字元的 prefix 回傳 `false`，與 `contains` 一致。
- `npm run demo` 新增 `startsWith <prefix>` 指令，輸出 `true` / `false`；`help` 說明列出此指令。
- 新增對應測試，並更新 README 的 API、Complexity、Tests 與 demo 說明。

## Non-Goals (optional)

（記錄於 design.md）

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `dictionary`: 新增「Prefix lookup」需求（`startsWith`）。
- `dictionary-cli`: 新增 `startsWith` 指令需求，並修改「Help and unknown commands」需求，讓使用說明列出 `startsWith`。

## Impact

- 修改程式碼：exercise-1-dictionary/src/dictionary.ts、exercise-1-dictionary/src/cli.ts
- 修改測試：exercise-1-dictionary/test/dictionary.test.ts、exercise-1-dictionary/test/cli.test.ts
- 更新文件：exercise-1-dictionary/README.md（API、Complexity 的 `startsWith` 列、Tests、Try it）
- 相依套件：無新增；runtime 僅用標準函式庫
