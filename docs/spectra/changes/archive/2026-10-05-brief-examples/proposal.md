## Why

在開始 Part C 之前重新核對面試題目，發現題目本身給的 Part A、B 範例沒有出現在 spec 與測試裡：題目用的字典是 `["cat", "car", "bar"]`，而現有測試用的是 `["cat", "car", "card"]` 與 `["cat", "car", "card", "dog"]`，所以 `contains("bat")`、`startsWith("ba")`、`startsWith("cr")` 從未被測試過。把題目範例逐字納入，讓面試官能直接對照題目確認每個範例都有測試。

## What Changes

- `dictionary` spec 的「Exact match lookup」需求新增一個 scenario，逐字對應題目 Part A 範例：`setup(["cat", "car", "bar"])` 後 `contains("cat")` 為 `true`、`contains("ca")` 為 `false`、`contains("bat")` 為 `false`。
- `dictionary` spec 的「Prefix lookup」需求新增一個 scenario，逐字對應題目 Part B 範例：同一字典下 `startsWith("ca")` 為 `true`、`startsWith("ba")` 為 `true`、`startsWith("cr")` 為 `false`。
- `exercise-1-dictionary/test/dictionary.test.ts` 新增對應這兩個 scenario 的測試。
- 不改變任何行為：需求文字不變，`exercise-1-dictionary/src/` 不變動，新測試在現有實作下即應通過。
- README：`exercise-1-dictionary/README.md` 的 Tests 段註明涵蓋題目原始範例；根目錄 `README.md` 的 Commit history 清單在 Part B 與 Part C 之間加入這個 commit。

## Non-Goals (optional)

- 不補 Part C 的題目範例：屬於 change `wildcard-search`，會在該 change 中加入。
- 不修改或刪除既有的 scenario 與測試（自訂字典的案例仍保留，涵蓋題目範例沒有的邊界情況）。
- 不改寫已提交的 Part A、B commit；以新的 commit 補上，保留解題過程。
- 不更動 `dictionary-cli` spec 與 CLI 測試：題目範例只定義字典方法，CLI 已有獨立案例。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `dictionary`: 「Exact match lookup」與「Prefix lookup」需求各新增一個題目原始範例的 scenario；需求文字與行為不變。

## Impact

- 修改 spec：docs/spectra/specs/dictionary/spec.md（封存時套用）
- 修改測試：exercise-1-dictionary/test/dictionary.test.ts
- 更新文件：exercise-1-dictionary/README.md（Tests 段）、README.md（Commit history）
- 程式碼與相依套件：無變更
