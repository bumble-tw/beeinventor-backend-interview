## Why

Exercise 2 的 `exercise-2-system-design/README.md` 目前只有章節骨架，每一節都是 TODO。題目要求「清楚寫出假設，並說明每個主要元件為什麼選它」，所以先完成整份設計的基礎：假設、容量估算、高層架構、文件與中繼資料的儲存。後面的資料流、擴展、部署、討論情境都依賴這四節的數字與元件。

## What Changes

- `exercise-2-system-design/README.md` 填寫四節（英文），每節只寫結論與一兩句理由：
  - **Assumptions**：題目沒有給、由我們自訂的假設（登入由外部身分服務處理、權限模型為擁有者加分享給個人或群組、上傳上限 20 MB、文件為純文字、段落約 2 KB、成長規劃到 2 倍、不做審核流程、一般使用者屬於數個到數十個群組等）。
  - **Capacity estimation**：S3、PostgreSQL、OpenSearch、上傳處理、API 的數量級估算與算式，標明哪些數字是估計、要用什麼實測驗證；結論指出瓶頸是搜尋要查詢所有 shard。
  - **High-level architecture**：元件清單（ALB、EKS 上的 api 與 worker、S3、Aurora PostgreSQL、SQS + DLQ、OpenSearch Service、ElastiCache Redis、CloudWatch／X-Ray），每個元件一句「為什麼選它」與可替換的方案；說明「無狀態程式放 EKS、存資料的交給 AWS 託管」的分工。
  - **Document storage and metadata storage**：原檔放 S3（versioning、lifecycle）、中繼資料放 Aurora PostgreSQL、搜尋用副本放 OpenSearch 的段落 index，以及三者的正本與副本關係。
- 用 archify skill 產生高層架構圖，存到 `exercise-2-system-design/diagrams/`，並在 High-level architecture 一節連結；圖的內容以 README 文字為準。
- 根目錄 `README.md` 的 Commit history：原本的「Exercise 2 — system design」改為依 change 拆開的清單，本 change 對應「Exercise 2 — assumptions, capacity, architecture」。

## Non-Goals (optional)

- 不填寫 API、上傳流程、佇列、索引一致性、權限、擴展、部署、可觀測性、討論情境、取捨等章節：分別屬於後續兩個 change。
- 不寫實作程式碼：題目只要求設計文件與圖。
- 不放詳細的選項比較與推導過程：README 只寫結論與一兩句理由；完整的取捨表放在後續 change 的「Trade-offs and alternatives considered」一節，且只列能用一句話說明理由的決策。
- 不給精確的機器規格或費用：只到數量級，並註明要用真實資料壓測確認。

## Impact

- Affected specs: none
- Affected code:
  - New: exercise-2-system-design/diagrams/ 底下的高層架構圖檔案（archify 產生的 HTML，可另附匯出圖片）
  - Modified: exercise-2-system-design/README.md, README.md
  - Removed: (none)
- Compatibility: no capability-level observable behavior changes
