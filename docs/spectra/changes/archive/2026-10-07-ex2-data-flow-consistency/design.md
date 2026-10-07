## Context

Change 1 已完成 Assumptions、Capacity estimation、High-level architecture、Document storage and metadata storage，並建立 `diagrams/high-level-architecture.*`。本 change 填寫資料流與一致性相關的六節，依 `exercise-2-system-design/CLAUDE.md`：圖用 archify 產生、存到 `diagrams/`、從 README 連結，圖的內容以 README 文字為準。

Change 1 的 review 找到兩類錯誤：圖和文字不一致、「之後會刪除」的說法沒有說清楚由誰、用什麼方式做到。本 change 的檢查會特別針對這兩類。

這是文件變更，不影響任何程式的可觀察行為。

## Goals / Non-Goals

**Goals:**

- 六節回答題目的三個可靠性與安全要求：重試不產生重複文件或重複 index、使用者絕對看不到沒權限的文件、刪除最終清除原檔與搜尋資料。
- 與 Change 1 的四節一致（20 MB 上限、約 2 KB 段落、刪除後最多約一天永久清除、元件名稱）。
- 每個「最終會發生」的說法都寫出由哪個元件、在什麼時間點、用什麼方式做到。

**Non-Goals:**

- 擴展、部署、可觀測性、討論情境、取捨表。
- 選項比較的細節。

## Decisions

### 寫作風格沿用 Change 1：結論優先，一兩句理由

只寫選擇與理由，不展開比較；用表格和短清單，避免長段落。

### 兩張 sequence 圖：上傳與背景處理、帶權限的搜尋

這兩條路徑步驟多、有先後順序，用 sequence 圖比文字清楚。刪除與權限撤銷用文字說明即可。

### 細節深度以「能用自己的話解釋」為界

例如讀取副本延遲的處理寫一兩句結論（剛改過權限的文件改查主資料庫），不寫實作細節。

## Implementation Contract

完成時，`exercise-2-system-design/README.md` 的六節滿足以下條件（人工逐條檢查）：

**API design**
- 說明登入由外部身分服務處理、API 驗證 JWT；路徑前綴 `/v1`。
- 端點表涵蓋：建立文件（取得上傳連結）、列表、詳情、下載連結、刪除；分享列表、分享、取消分享；群組建立、列表、加入與移除成員；搜尋。每個端點寫出誰可以呼叫。
- 建立文件與搜尋各有一組請求／回應範例。
- 共通規則：錯誤格式含 `requestId`；沒有權限回 `404`（不洩漏文件是否存在）；大小超過上限回 `413`；限流回 `429` 並附 `Retry-After`；`POST /v1/documents` 必帶 `Idempotency-Key`；列表用 cursor、搜尋用 page（每頁最多 20 筆、最多 100 頁）；搜尋高亮先跳脫 HTML 再加標記。

**Core data model**
- 文件狀態機：UPLOADING、PROCESSING、SEARCHABLE、FAILED、EXPIRED、DELETED，以及每日 purge 永久清除（刪除的文件在搜尋資料清除後；EXPIRED、FAILED 在 7 天後）；不提供還原；說明所有轉換都用條件更新。
- PostgreSQL 資料表：`users`、`groups`、`group_members`、`documents`（含 `status`、`acl_version`、`claimed_at`、`search_cleared_at`、`s3_key`、`s3_version_id`、`idempotency_key` 與時間戳記）、`document_grants`（帶類型的身分）、`audit_log`；主要的唯一約束與索引。
- OpenSearch `chunks` index 主要欄位：`_id = {docId}-{chunkNo}`、`docId`、`acl_version`、`text`（中文切詞）、`acl`；不存 `status`（正確性由回傳前的 DB 確認保證）；透過 alias 存取。

**Upload and asynchronous processing pipeline**
- 流程：建立文件（UPLOADING，連結 15 分鐘）→ presigned POST 直傳 S3（policy 限制 1 B～20 MB 與固定 key）→ S3 事件進 SQS → worker 條件更新為 PROCESSING（含 10 分鐘寬限）→ 檢查實際內容（大小、UTF-8）→ 切成約 2 KB 段落並重疊 → bulk 寫入 OpenSearch → SEARCHABLE。
- 連結到上傳與背景處理的 sequence 圖。
- 例外：沒傳的上傳由清理 CronJob 改為 EXPIRED；太晚傳完的檔案由 worker 刪除（只在狀態是 EXPIRED 時）；同一連結重傳時 worker 不重做、不刪檔；內容檢查失敗改為 FAILED。
- 說明上傳完成以 S3 事件為準，不依賴前端回報。

**Message queue, retries, idempotency, and dead-letter handling**
- SQS Standard + DLQ；上傳的工作是 S3 事件本身（從 key 解析 `docId`）；其他訊息為 `{docId, action}`。
- visibility timeout 大於最長處理時間，處理中延長；超過 `maxReceiveCount`（5 次）移到 DLQ、告警、修好後 redrive；DLQ 保留 14 天。
- 冪等做法：處理前讀 DB 狀態；段落 `_id` 固定；文件內容上傳後不會改變；DB 用設定值而非累加；worker 一律讀主資料庫。
- 一句話說明為什麼不需要佇列保證順序或只送一次。

**Search indexing and DB ↔ search engine consistency**
- PostgreSQL 是正本，OpenSearch 是可重建的副本；不一致時以 DB 為準。
- 新鮮度：refresh 約 30 秒，一般約 1 分鐘可搜尋（與 Capacity estimation 一致）。
- 文件內容上傳後不會改變（沒有編輯功能），所以不需要內容版本號；重建 index 時寫入新的 index 再切換 alias。
- 刪除：`api` 立即標記 DELETED（回傳前 DB 確認只保留 SEARCHABLE，所以立即看不到）→ `delete-worker` 依 `docId` 刪除段落 → index worker 寫完後再檢查狀態，若已刪除就清掉剛寫的段落 → 下一次每日 purge 依版本 ID 刪除所有 S3 版本與中繼資料（約一天內）。每一步寫出由誰執行。
- 從正本重建：新 index 寫入後切換 alias。

**Authorization and permission filtering**
- 權限模型：擁有者加上分享給個人或群組；身分帶類型（`user:12`、`group:7`）；判斷只在 `principals(user)` 與 `authorize(user, action, doc)` 兩處。
- 搜尋：身分清單送進 OpenSearch `terms` 過濾（filter，不計分），回傳前用 DB 確認這一頁；說明 OpenSearch 負責效率、DB 負責正確。
- 撤銷：取消分享時非同步更新 `acl`；空窗期由回傳前確認擋住；剛改過權限的文件改查主資料庫，避免讀取副本延遲。
- 群組不展開成成員；身分清單上限（OpenSearch 預設 65,536 值）寫成假設。
- 其他保護：沒權限回 404、搜尋快取的 key 含身分清單、下載連結短效。
- 擴充：組織、公開、審核等可作為新的身分類型加入，不改架構。
- 連結到搜尋的 sequence 圖。

**其他**
- 兩張 sequence 圖存在 `diagrams/`，archify showcase 驗證通過，參與者名稱與 README 元件名稱一致，圖中每一步都能在 README 文字找到對應。
- 與 Change 1 四節的數字與名稱一致；其他章節（擴展、部署、可觀測性、討論情境、取捨）維持 TODO。
- 全文英文；capability-level observable behavior is unchanged。

## Risks / Trade-offs

- [圖與文字不一致] → 先寫完文字再畫圖；檢查時逐一比對圖中每一步與 README 的對應句子。
- [「最終會刪除」說不清楚由誰做] → 契約要求每一步寫出執行者；檢查時逐句確認。
- [內容太深，面試時答不出來] → 只寫結論與一兩句理由。
- [與 Change 1 已寫內容矛盾] → 檢查時對照 Assumptions、Capacity、Architecture 的數字與名稱；必要的更正列在 tasks。

## Migration Plan

純文件變更，直接 commit；修正以新 commit 進行。

## Open Questions

（無）
