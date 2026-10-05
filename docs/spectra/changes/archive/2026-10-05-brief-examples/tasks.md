## 1. 題目範例測試

- [x] 1.1 在 `exercise-1-dictionary/test/dictionary.test.ts` 的 `describe("Exact match lookup")` 新增測試「Exact match examples from the interview brief」，在 `describe("Prefix lookup")` 新增測試「Prefix examples from the interview brief」，兩者都以 `dictionaryWith(["cat", "car", "bar"])` 建立字典，逐一斷言 spec 該 scenario 列出的結果（`contains`：`cat` 為 `true`、`ca` 與 `bat` 為 `false`；`startsWith`：`ca` 與 `ba` 為 `true`、`cr` 為 `false`）。既有測試與 `exercise-1-dictionary/src/` 都不修改。這個 change 不改變行為，所以新測試在現有實作下應直接通過，這證明 Part A、B 的實作已符合題目範例。驗證：在 `exercise-1-dictionary/` 執行 `npm test`，全部通過且總數從 69 項增為 71 項；`npm run typecheck` 無錯誤。

## 2. 文件

- [x] 2.1 [after: 1.1] 更新 `exercise-1-dictionary/README.md` 的 Tests 段，在 Exact match 與 Prefix search 的條目中註明也涵蓋題目原始範例（字典 `["cat", "car", "bar"]`：`contains` 的 `cat` / `ca` / `bat`，`startsWith` 的 `ca` / `ba` / `cr`）；並在根目錄 `README.md` 的 Commit history 清單中，於「Exercise 1 — Part B: prefix search」與「Exercise 1 — Part C: wildcard search」之間加入「Exercise 1 — brief examples for Parts A/B」並重新編號。驗證：人工檢視兩份 README，Tests 段提到題目範例，Commit history 清單的順序與預計的 commit 順序（Part B → brief examples → Part C）一致。
