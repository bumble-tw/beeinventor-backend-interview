## Context

`exercise-2-system-design/README.md` 已有章節骨架。設計決策已在討論中定案，這個 change 只負責把其中四節寫成面試官能讀的英文文件，並產生高層架構圖。依 `exercise-2-system-design/CLAUDE.md`：圖用 archify 產生、存到 `diagrams/` 並從 README 連結，圖的內容以 README 文字為準。

這是文件變更，不影響任何程式的可觀察行為。

## Goals / Non-Goals

**Goals:**

- 四節內容完整、彼此一致，且數字可以從題目數字一步步推出。
- 面試官只讀這四節，就能說出：系統有哪些元件、各自為什麼選、資料存在哪、規模大約多大、瓶頸在哪。
- 每個數字標明是「題目給的」、「假設」或「推算」。

**Non-Goals:**

- 其他章節（屬於後續 change）。
- 詳細的選項比較：只寫選擇與一句理由。

## Decisions

### 寫作風格：結論優先，一兩句理由

每個元件或數字先講結論，再用一兩句說明理由；不展開選項比較。理由：README 是給面試官快速掌握全貌的文件，細節在面談時口頭補充。

### 數字只到數量級，並註明驗證方式

OpenSearch 的大小與查詢成本受中文切詞、壓縮率影響很大，寫成範圍或數量級，並說明會用約 1 萬份真實書籍建 index 實測再推算。理由：假裝精確的數字反而容易被追問到答不出來。

### 架構圖用 archify，內容與 README 一致

圖只畫 README 提到的元件與連線，顏色區分「EKS 內的程式」與「AWS 託管服務」，標示搜尋、上傳、背景處理三條路徑。

## Implementation Contract

完成時，`exercise-2-system-design/README.md` 的四節滿足以下條件（人工逐條檢查）：

**Assumptions**
- 列出題目沒給、由我們自訂的假設，每條一行，至少包含：登入由外部身分服務（例如 Amazon Cognito）處理，API 驗證 JWT；權限模型為擁有者加上分享給個人或群組，一人可屬多個群組；文件為純文字（UTF-8）；單檔上限 20 MB（平均 2 MB 的 10 倍）；段落約 2 KB、前後重疊約 100 字；容量規劃到目前的 2 倍；不做審核或內容管理流程；刪除為軟刪除，30 天後永久清除；一般使用者屬於數個到數十個群組。

**Capacity estimation**
- 有一張結果總表，涵蓋：S3 約 20 TB（2 倍約 40 TB）；PostgreSQL < 50 GB、1 主 + 2 讀取副本；OpenSearch 約 100 億段落、primary 約 25 TB、每 shard 3 份（分 3 個 AZ）加預留約 100 TB、1,000 個 primary shard、約 40 台資料節點；worker 尖峰約 40 Pod；API 尖峰約 20 Pod。
- 每個主要數字附一行算式（例如 `10M docs × 2 MB = 20 TB`、`2 MB ÷ 2 KB ≈ 1,000 passages/doc`）。
- 有搜尋 500 ms 與新鮮度 5 分鐘兩個時間預算表。
- 明確寫出瓶頸：每次搜尋要查詢所有 shard（3,000 rps × 1,000 shards），所以節點數以壓測為準。
- 標明哪些是估計值及驗證方式。

**High-level architecture**
- 連結 `diagrams/` 底下的高層架構圖。
- 元件清單，每個元件一句「為什麼選它」：ALB（+WAF）、EKS 上的 api／index-worker／delete-worker／CronJob、S3、Aurora PostgreSQL、SQS + DLQ、OpenSearch Service、ElastiCache Redis、CloudWatch／X-Ray（OpenTelemetry）。
- 一句話說明分工：無狀態程式放 EKS，存資料的交給 AWS 託管。
- 說明可替換性：設計依賴的是能力（物件儲存 + presigned URL + 事件通知、至少一次送達的佇列 + DLQ、支援 filter 與 highlight 的搜尋引擎、有交易的關聯式資料庫），換雲只換對應服務。
- 簡述三條路徑：搜尋、上傳、背景處理。

**Document storage and metadata storage**
- S3：原檔，key 為 `docs/{docId}/v{n}`，開 versioning；lifecycle 只清除未完成的分段上傳；被取代的版本保留（下載提供 worker 處理過的版本）；永久刪除時依版本 ID 刪除所有版本。
- Aurora PostgreSQL：文件狀態、權限、群組等中繼資料；是正本。
- OpenSearch：段落 index，是可以從 S3 與 PostgreSQL 重建的搜尋用副本。
- 一句話說明為什麼中繼資料不放 S3 metadata（需要條件查詢、交易、join）。

**其他**
- 四節以外的章節維持 TODO，不被改動。
- 根目錄 `README.md` 的 Commit history 反映 Exercise 2 拆成多個 commit。
- 程式碼與 Exercise 1 不受影響；capability-level observable behavior is unchanged。

## Risks / Trade-offs

- [寫得太深，面試時被追問到答不出來] → 只寫能用自己的話解釋的結論；深入細節留到面談口頭說明。
- [數字被當成精確承諾] → 標明估計值，並寫出用真實資料壓測的驗證方式。
- [圖與文字不一致] → 先寫完 README，再依文字產生圖；檢查時逐一比對元件名稱。

## Migration Plan

純文件變更，直接 commit；需要修正時以新 commit 修改，不改寫歷史。

## Open Questions

（無）
