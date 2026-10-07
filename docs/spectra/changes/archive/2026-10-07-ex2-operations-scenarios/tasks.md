## 1. README 五節內容

- [x] 1.1 在 `exercise-2-system-design/README.md` 的 Scaling services, workers, and search infrastructure 一節寫出各層自動擴展表（含擴充所需時間）、OpenSearch 依尖峰 2 倍規劃的理由、流量暴增的降級順序與流量來源判斷。驗證：人工對照 design.md 契約；快取描述與 Authorization 一節（只存 OpenSearch 原始結果、回傳前確認照跑）一致。
- [x] 1.2 [after: 1.1] 在 Deployment (containers and Kubernetes) 一節寫出工作負載表、五個部署重點、部署與回退流程；先保留 EKS 部署圖連結的位置。驗證：人工對照契約；worker 的優雅關閉與 Message queue 一節的 visibility timeout、`claimed_at` 接手規則一致。
- [x] 1.3 [after: 1.2] 在 Observability 一節寫出工具、log 欄位與不記錄的內容、兩個 SLO 與主要告警（初始值）、trace 跨 SQS 的方式、四個儀表板。驗證：人工對照契約；SLO 數字與 Capacity estimation 一致，告警涵蓋 DLQ、卡在 `PROCESSING`、purge 未完成。
- [x] 1.4 [after: 1.3] 在 Discussion scenarios 五個小節寫出答案，每個兩到四句並連結到被引用的章節，不新增機制。驗證：人工逐句確認每個說法都能在被引用章節找到；若發現前面章節缺漏，先修改該章節並在 tasks 新增一筆更正紀錄。
- [x] 1.5 [after: 1.4] 在 Trade-offs and alternatives considered 一節寫出決策表（至少契約列出的 11 項），每列理由一句話。驗證：人工確認每列的選擇與前面章節一致，理由只有一句。

## 2. EKS 部署圖

- [x] 2.1 [after: 1.2] 使用 archify skill，依 Deployment 一節產生 EKS 部署圖，存到 `exercise-2-system-design/diagrams/`（JSON、HTML、只含圖的 PNG），並放進 Deployment 一節的保留位置（PNG 連到互動 HTML，附 JSON 原始檔連結）。驗證：`archify validate architecture … --quality showcase` 0 錯誤 0 警告；`visual-check` 通過；元件名稱與 Deployment 一節、高層架構圖一致；README 的相對路徑都存在；`diagrams/` 沒有檢查過程的暫存檔。

## 3. 收尾

- [x] 3.1 在根目錄 `README.md` 的「Exercise 1 at a glance」之後新增「Exercise 2 at a glance」：設計重點、主要假設、文件與圖的位置，不超過 6 行要點。驗證：人工檢視風格與 Exercise 1 一節一致，連結的路徑都存在。
- [x] 3.2 [after: 1.5, 2.1, 3.1] 整體檢查：README 沒有 TODO；五節符合 design.md 的 Implementation Contract 與三項 Decisions（「討論情境與取捨表只引用，不新增」「寫作風格沿用前兩個 change：結論優先，一兩句理由」「EKS 部署圖：區分 EKS 內的程式與 AWS 託管服務」）；名稱與數字和前面章節一致；全文英文。驗證：`grep -c '^TODO$'` 為 0；`git diff --stat` 只列出 proposal 的 Impact 中的檔案；人工逐條勾選 Implementation Contract。

## 4. 對前面章節的更正（verify、review 後）

- [x] 4.1 High-level architecture 的 CronJobs 說明補上「計算卡住的文件供告警使用」，因為 Observability 的卡住文件告警由清理排程計算；Core data model 的 `outbox` 表新增 `trace_context` 欄位，因為 api 送出的訊息要帶 trace 跨過 SQS（S3 送出的上傳事件無法帶我們的 trace，改用 `docId` 串接 log）；高層架構圖的 CronJobs 副標改為「cleanup · purge」，與 README 和 EKS 部署圖一致，並重新產生 HTML 與 PNG。驗證：人工確認三處與 Observability、Deployment 一節一致；archify 驗證與 visual-check 通過。
