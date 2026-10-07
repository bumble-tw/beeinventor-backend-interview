## Why

Change 1 寫完了假設、容量估算、高層架構與儲存，但題目要求的核心資料流仍是 TODO：API 與資料模型、上傳與非同步處理、佇列與重試、搜尋索引與資料庫的一致性、權限過濾。這幾節回答題目的可靠性與安全要求（重試不能產生重複、使用者絕對看不到沒權限的文件、刪除最終要清乾淨），也是討論情境 2～4 的基礎。

## What Changes

- `exercise-2-system-design/README.md` 填寫六節（英文，結論加一兩句理由）：
  - **API design**：REST 端點一覽（文件、分享、群組、搜尋）、建立文件與搜尋的請求／回應範例、共通規則（錯誤格式含 requestId、沒有權限回 404、Idempotency-Key、分頁方式、限流回 429）。
  - **Core data model**：文件狀態機、PostgreSQL 資料表、OpenSearch 段落 index 的主要欄位；所有狀態轉換用條件更新。
  - **Upload and asynchronous processing pipeline**：presigned POST 直傳 S3、S3 事件觸發處理、切段落與寫入、沒傳完或太晚傳完的上傳怎麼處理。
  - **Message queue, retries, idempotency, and dead-letter handling**：SQS Standard + DLQ、visibility timeout、重試次數、worker 冪等的做法。
  - **Search indexing and DB ↔ search engine consistency**：PostgreSQL 為正本、版本號、新鮮度、刪除時的處理、從正本重建 index。
  - **Authorization and permission filtering**：擁有者加分享的權限模型、搜尋時的過濾與回傳前確認、撤銷權限的空窗期、擴充方式。
- 用 archify 產生兩張 sequence 圖，存到 `exercise-2-system-design/diagrams/`，並從對應章節連結：上傳與背景處理、帶權限的搜尋。
- 不需要修改根目錄 `README.md`：Commit history 已在 Change 1 列出本 change 對應的「Exercise 2 — data flow and consistency」。

## Non-Goals (optional)

- 不填寫擴展、部署、可觀測性、討論情境、取捨表：屬於下一個 change。
- 不寫實作程式碼。
- 不展開選項比較：只寫選擇與一兩句理由；完整的取捨表在下一個 change。
- 不修改 Change 1 已完成的四節，除非為了與本 change 內容一致而必須更正；若有更正，在 tasks 中明列。

## Impact

- Affected specs: none
- Affected code:
  - New: exercise-2-system-design/diagrams/ 底下兩張 sequence 圖（archify 的 JSON 原始檔、HTML 與 PNG）
  - Modified: exercise-2-system-design/README.md, exercise-2-system-design/diagrams/high-level-architecture.json, exercise-2-system-design/diagrams/high-level-architecture.html
  - Removed: (none)
- Compatibility: no capability-level observable behavior changes
