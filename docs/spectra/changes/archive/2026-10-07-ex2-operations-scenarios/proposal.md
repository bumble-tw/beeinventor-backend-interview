## Why

Exercise 2 的 README 只剩最後一組 TODO：擴展、部署、可觀測性、五個討論情境、取捨表。這些是題目明確列出的主題與情境；完成後 Exercise 2 就沒有 TODO。Change 2 的經驗是：超出題目的功能和一路疊加的機制會帶來新的漏洞，所以這個 change 的討論情境與取捨表只引用前面章節已經寫好的設計，不新增機制。

## What Changes

- `exercise-2-system-design/README.md` 填寫最後五節（英文，結論加一兩句理由）：
  - **Scaling services, workers, and search infrastructure**：各層怎麼自動擴展（HPA、KEDA、Karpenter、Aurora 讀取副本、OpenSearch），以及搜尋流量暴增時「先保護、再擴充」的降級順序。
  - **Deployment (containers and Kubernetes)**：EKS 上的工作負載、健康檢查、滾動更新、優雅關閉、分散 3 個 AZ 與 PodDisruptionBudget、權限與設定。
  - **Observability (logs, metrics, tracing, incident investigation)**：OpenTelemetry 加 CloudWatch／X-Ray、log 欄位、依兩個 SLO 設計的指標與告警、trace 如何跨過 SQS。
  - **Discussion scenarios**：五個情境各自的答案，主要引用前面章節。
  - **Trade-offs and alternatives considered**：精簡決策表（選擇、其他選項、一句理由）。
- 用 archify 產生 EKS 部署圖，存到 `exercise-2-system-design/diagrams/`，並從 Deployment 一節連結。
- 根目錄 `README.md` 新增「Exercise 2 at a glance」一節，對應現有的「Exercise 1 at a glance」。

## Non-Goals (optional)

- 不新增前面章節沒有的機制或功能；討論情境若需要新元件，先回頭修改前面章節並在 tasks 記錄。
- 不寫實作程式碼、Kubernetes manifest 全文或 Terraform。
- 取捨表不列無法用一句話說明理由的決策；完整比較不放 README。
- 不給精確的告警門檻或機器規格：寫成初始值，並說明由壓測調整。

## Impact

- Affected specs: none
- Affected code:
  - New: exercise-2-system-design/diagrams/ 底下的 EKS 部署圖（archify 的 JSON、HTML 與 PNG）
  - Modified: exercise-2-system-design/README.md, README.md, exercise-2-system-design/diagrams/high-level-architecture.json, exercise-2-system-design/diagrams/high-level-architecture.html, exercise-2-system-design/diagrams/high-level-architecture.png
  - Removed: (none)
- Compatibility: no capability-level observable behavior changes
