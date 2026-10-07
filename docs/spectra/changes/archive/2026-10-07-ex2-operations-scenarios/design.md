## Context

Change 1、2 已完成假設、容量、架構、儲存、API、資料模型、上傳流程、佇列、一致性、權限。這個 change 完成最後五節與 EKS 部署圖，Exercise 2 的 README 之後就沒有 TODO。

Change 2 的 review 與 verify 共跑了五輪，問題來自兩處：功能超出題目（還原）、每次修正都疊加新機制。本 change 的原則是：**討論情境與取捨表只引用已經寫好的設計**；擴展、部署、可觀測性只寫營運面的做法，不改變資料流。

這是文件變更，不影響任何程式的可觀察行為。

## Goals / Non-Goals

**Goals:**

- 回答題目第 7～9 個主題與五個討論情境，每個情境的答案都能指回前面的章節。
- 與前面章節的元件名稱、數字、狀態名稱一致（例如 SLO 500 ms 與 5 分鐘、約 1 分鐘可搜尋、DLQ 收 5 次失敗、`claimed_at` 接手規則）。
- 取捨表的每一列都能用一句話說明理由。

**Non-Goals:**

- 新增資料流、狀態或元件。
- 完整的選項比較、manifest、Terraform。

## Decisions

### 討論情境與取捨表只引用，不新增

每個情境的答案用兩到四句寫結論，再連結到前面章節。如果寫的時候發現前面章節缺了某個說明，先停下來，回頭修改那一節並記錄在 tasks，不在情境裡發明新機制。

### 寫作風格沿用前兩個 change：結論優先，一兩句理由

用表格和短清單；數字標明是初始值或估計，並說明由壓測或實際資料調整。

### EKS 部署圖：區分 EKS 內的程式與 AWS 託管服務

圖畫出 EKS 上的工作負載與叢集元件、交付流程（CI、ECR、Argo CD）、擴展依據（SQS），以及權限與密碼（Pod Identity、Secrets Manager），標示三個 AZ。資料服務（S3、Aurora、OpenSearch、Redis）刻意不畫，README 註明請看高層架構圖；元件名稱與高層架構圖一致。

## Implementation Contract

完成時滿足以下條件（人工逐條檢查）：

**Scaling services, workers, and search infrastructure**
- 各層自動擴展表：`api` 用 HPA（CPU）、`index-worker`／`delete-worker` 用 KEDA（SQS 排隊數）、節點用 Karpenter、Aurora 讀取副本用 Aurora Auto Scaling、OpenSearch 依壓測與告警手動或排程調整；並寫出各層擴充大約需要多久。
- 說明 OpenSearch 是最慢擴充的一層（加節點數十分鐘、加副本數小時），所以平時依尖峰的 2 倍規劃。
- 流量暴增時的降級順序：讓出寫入資源（犧牲新鮮度）→ 快取 OpenSearch 原始結果（回傳前確認照跑）→ 精簡查詢 → 每人限流 → 整體回 `429`；權限確認永不降級。
- 先判斷流量來源（真實使用者、爬蟲、自身 bug）。

**Deployment (containers and Kubernetes)**
- EKS 上的工作負載表：`api`、`index-worker`、`delete-worker`、CronJob（清理、purge），以及節點分散 3 個 AZ。
- 五個重點各一兩句：readiness／liveness（liveness 不檢查外部依賴）、滾動更新（不降容量、映像檔用 commit SHA、資料庫結構先擴充後收斂）、優雅關閉（api 處理完請求；worker 停止取新訊息，做不完就不刪訊息）、topology spread 與 PodDisruptionBudget、EKS Pod Identity 最小權限與 Secrets Manager。
- 一句話說明部署流程（CI 建映像檔 → ECR → GitOps 同步 → 滾動更新）與回退方式。
- 連結 EKS 部署圖。

**Observability (logs, metrics, tracing, incident investigation)**
- 工具：程式用 OpenTelemetry，經 ADOT Collector 送到 CloudWatch 與 X-Ray；log 由 logger 以 JSON 寫到 stdout。
- log 欄位：`traceId`、`docId`、`userId`、`event`；不記錄文件內容、presigned 連結、密碼。
- 兩個 SLO（搜尋 p99 < 500 ms、上傳到可搜尋 < 5 分鐘，以 `searchable_at - uploaded_at` 量測）與主要告警：搜尋延遲與錯誤率、新鮮度、SQS 最舊訊息、DLQ 有訊息、卡在 `PROCESSING` 太久的文件、OpenSearch 叢集狀態與 rejections、讀取副本延遲、purge 未完成。告警門檻寫成初始值。
- trace 跨 SQS：送訊息時把 `traceparent` 放進訊息屬性，worker 接回去。
- 四個儀表板。

**Discussion scenarios**
- 情境 1（30 分鐘還搜不到）：先判斷一份還是很多份；一份就用 `docId` 查狀態，依 `UPLOADING`／`PROCESSING`／`FAILED`／`SEARCHABLE` 分流；很多份就看佇列等待、worker 上限、OpenSearch rejections；用 trace 看完整路徑；事後補告警。引用 Observability。
- 情境 2（worker 處理中當掉）：訊息不會被刪，visibility timeout 後重現；下一個 worker 依同一 S3 版本與 `claimed_at` 接手；段落 ID 固定所以不重複。引用 Upload pipeline 與 Message queue。
- 情境 3（同一訊息送兩次）：冪等做法。引用 Message queue。
- 情境 4（處理中被刪除）：立即看不到（回傳前確認）、`delete-worker` 刪段落、worker 遇到已刪除文件時先刪段落再確認訊息、每日 purge。引用 Search indexing and consistency。
- 情境 5（搜尋流量 10 倍）：先保護再擴充、降級順序、判斷流量來源。引用 Scaling。
- 每個情境都附連結到被引用的章節。

**Trade-offs and alternatives considered**
- 決策表：選擇、其他選項、一句理由。至少涵蓋：AWS 託管服務、SQS Standard + DLQ、段落 index、OpenSearch、ACL 寫進 index 加回傳前確認、presigned 直傳 S3、刪除後約一天永久清除（不提供還原）、3 個 AZ、容量規劃到 2 倍、transactional outbox、OpenTelemetry。
- 每列理由一句話。

**根目錄 README**
- 新增「Exercise 2 at a glance」：設計重點、主要假設、文件與圖的位置，風格與「Exercise 1 at a glance」一致，不超過 6 行要點。

**其他**
- EKS 部署圖存在 `diagrams/`，archify showcase 驗證通過、visual-check 通過；元件名稱與 Deployment 一節、高層架構圖一致。
- 與前面章節的名稱、數字一致；全文英文；README 不再有 TODO。
- capability-level observable behavior is unchanged。

## Risks / Trade-offs

- [情境答案發明了新機制] → 每個情境都要能指回前面章節；檢查時逐句確認。
- [告警數字被當成承諾] → 寫成初始值，說明依壓測調整。
- [篇幅過長] → 每節以表格為主，情境每個兩到四句。

## Migration Plan

純文件變更，直接 commit。

## Open Questions

（無）
