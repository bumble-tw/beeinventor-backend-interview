## Why

Exercise 1 的 Part C 要求 wildcard search：以含萬用字元的模式（pattern）查詢字典，`?` 代表剛好一個字元，`*` 代表零個或多個字元。Part A、B 已完成 `createDictionary()`（Trie 結構）、`contains`、`startsWith` 與 `npm run demo` 命令列，Part C 在同一個 Trie 上新增 `search`，並讓使用者能在命令列直接試用。

## What Changes

- `Dictionary` interface 新增 `search(pattern: string): boolean`：只要最近一次成功 `setup` 載入的單字中，有任何一個「整個字」符合 pattern 就回傳 `true`，否則回傳 `false`。`?` 符合剛好一個 `a-z` 字元，`*` 符合零個或多個 `a-z` 字元，其他字元必須完全相同。
- 符合是整字比對（不是部分比對）：`search("ca")` 不會因為字典有 `cat` 而回傳 `true`；要找開頭為 `ca` 的字需寫 `ca*`。
- 空字串在字典裡完全不存在：`search("")` 一律回傳 `false`；`search("*")` 只在字典至少有一個單字時回傳 `true`（因為 `*` 不會符合不存在的空字）。
- 題目 Part C 的原始範例（字典 `["cat", "car", "bar"]`：`search("c?t")`、`search("*at")`、`search("ca*")`、`search("*")` 為 `true`，`search("cr*")` 為 `false`）逐字納入 spec 與測試，與 Part A、B 的題目範例（commit `test(exercise-1): cover the brief's Part A/B examples`）一致。
- `search` 對任何字串都不丟錯；含 `a-z`、`?`、`*` 以外字元的 pattern 回傳 `false`，與 `contains`、`startsWith` 一致。
- 多個 `*` 的 pattern（例如 `*a*b*`）的執行時間有上限，不會隨 `*` 數量呈指數成長。
- `npm run demo` 新增 `search <pattern>` 指令，輸出 `true` / `false`；`help` 說明列出此指令。
- 新增對應測試，並更新 README 的 API、Assumptions、Complexity、Trade-offs、Tests 與 Try it。

## Non-Goals (optional)

（記錄於 design.md）

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `dictionary`: 新增「Wildcard lookup」需求（`search`）。
- `dictionary-cli`: 新增 `search` 指令需求，並修改「Help and unknown commands」需求，讓使用說明列出 `search`。

## Impact

- 修改程式碼：exercise-1-dictionary/src/dictionary.ts、exercise-1-dictionary/src/cli.ts
- 修改測試：exercise-1-dictionary/test/dictionary.test.ts、exercise-1-dictionary/test/cli.test.ts
- 更新文件：exercise-1-dictionary/README.md（API、Assumptions、Data structure choice、Complexity 的 `search` 列、Trade-offs、Tests、Try it）、README.md（How to run 與 Exercise 1 at a glance 提到 `search`）
- 相依套件：無新增；runtime 僅用標準函式庫
