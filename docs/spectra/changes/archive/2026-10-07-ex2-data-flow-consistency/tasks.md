## 1. README 六節內容

- [x] 1.1 在 `exercise-2-system-design/README.md` 的 API design 一節，用英文寫出 design.md「Implementation Contract／API design」要求的登入假設、端點表（含誰可以呼叫）、建立文件與搜尋的請求／回應範例、共通規則，取代 TODO。驗證：人工對照契約清單，每一項都出現在該節。
- [x] 1.2 [after: 1.1] 在 Core data model 一節寫出文件狀態機、PostgreSQL 資料表與主要約束、OpenSearch 段落 index 主要欄位，並說明狀態轉換都用條件更新。驗證：人工對照契約清單；狀態名稱與 API design、Change 1 的 Assumptions 一致。
- [x] 1.3 [after: 1.2] 在 Upload and asynchronous processing pipeline 一節寫出上傳到可搜尋的流程、四種例外（沒傳、太晚傳完、同一連結重傳、內容檢查失敗）各自由誰處理，以及「上傳完成以 S3 事件為準」；先保留 sequence 圖連結的位置。驗證：人工對照契約清單；20 MB、15 分鐘、10 分鐘寬限、約 2 KB 段落與 Change 1 一致。
- [x] 1.4 [after: 1.3] 在 Message queue, retries, idempotency, and dead-letter handling 一節寫出 SQS + DLQ 設定、重試與 DLQ 處理、冪等的四種做法，以及不需要佇列保證順序的理由。驗證：人工對照契約清單。
- [x] 1.5 [after: 1.4] 在 Search indexing and DB ↔ search engine consistency 一節寫出正本／副本關係、新鮮度、內容更新、刪除的每一步與執行者、從正本重建 index。驗證：人工逐句確認每個「之後會發生」的說法都寫出執行者與方式；新鮮度數字與 Capacity estimation 一致。
- [x] 1.6 [after: 1.5] 在 Authorization and permission filtering 一節寫出權限模型、搜尋過濾與回傳前確認、撤銷權限的空窗期處理、身分清單上限假設、其他保護與擴充方式；先保留搜尋 sequence 圖連結的位置。驗證：人工對照契約清單。

## 2. Sequence 圖

- [x] 2.1 [after: 1.3] 使用 archify skill，依 Upload and asynchronous processing pipeline 一節產生「上傳與背景處理」sequence 圖，存到 `exercise-2-system-design/diagrams/`（JSON 原始檔、HTML、只含圖的 PNG）。驗證：`archify validate sequence … --quality showcase` 通過且 0 錯誤 0 警告；`visual-check` 通過；參與者名稱與 README 元件名稱一致，圖中每一步都能在該節文字找到對應。
- [x] 2.2 [after: 1.6] 使用 archify skill，依 Authorization and permission filtering 一節產生「帶權限的搜尋」sequence 圖，存到 `exercise-2-system-design/diagrams/`（JSON、HTML、只含圖的 PNG）。驗證：同 2.1。
- [x] 2.3 [after: 2.1, 2.2] 在兩節的保留位置加入圖（PNG 圖片連到互動 HTML，並附 JSON 原始檔連結），刪除 `diagrams/` 底下檢查過程產生的暫存檔。驗證：從 README 所在目錄解析每個相對路徑，檔案都存在；`diagrams/` 只剩兩張圖各自的 JSON、HTML、PNG 加上 Change 1 的三個檔案。

## 3. 收尾

- [x] 3.1 [after: 2.3] 整體檢查：六節符合 design.md 的 Implementation Contract 與 Decisions：「寫作風格沿用 Change 1：結論優先，一兩句理由」「兩張 sequence 圖：上傳與背景處理、帶權限的搜尋」「細節深度以能用自己的話解釋為界」；與 Change 1 四節的數字與名稱一致，若需要更正則記錄更正內容；擴展、部署、可觀測性、討論情境、取捨章節仍是 TODO；全文英文。驗證：`git diff --stat` 只列出 proposal 的 Impact 中提到的檔案，並人工逐條勾選 Implementation Contract。

## 4. 對 Change 1 章節的更正

- [x] 4.1 `exercise-2-system-design/README.md` 的 Document storage and metadata storage 一節中，OpenSearch 一列的「text, document ID, status」改為「text, document ID」；High-level architecture 的元件表中，`index-worker` 的說明補上「也負責改寫段落上的權限」。理由：OpenSearch 不存 `status`，刪除後立即看不到是由回傳前的 DB 確認（只保留 `SEARCHABLE`）保證；`acl` 訊息由 `index-worker` 處理。驗證：人工確認兩節的敘述與 Core data model、Authorization 一致。
- [x] 4.2 拿掉「還原」功能（題目沒有要求，而且它造成刪除與還原的時序衝突），刪除改為下一次每日 purge 就永久清除（約一天內）。更正 Change 1 的章節：Assumptions 的刪除那一條改為「沒有復原，約一天內永久清除」；High-level architecture 的 CronJobs 說明與 Delete 路徑改為每日 purge，並包含 7 天後的 EXPIRED、FAILED；Document storage 的 Aurora 一列拿掉 `version`；高層架構圖 Delete 導覽的說明同步修改並重新產生 HTML。驗證：人工確認 README 沒有出現 restore、trash 或「30 days」，且各節對刪除時間的描述一致。
