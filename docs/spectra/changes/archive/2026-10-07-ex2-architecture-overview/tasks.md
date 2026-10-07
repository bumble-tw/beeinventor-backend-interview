## 1. README 四節內容

- [x] 1.1 在 `exercise-2-system-design/README.md` 的 Assumptions 一節，用英文逐條列出 design.md「Implementation Contract／Assumptions」要求的每一項自訂假設（每條一行，必要時附半句理由），取代原本的 TODO。驗證：人工對照 design.md 的清單，每一項都出現在該節。
- [x] 1.2 [after: 1.1] 在 Capacity estimation 一節寫出結果總表、每個主要數字的一行算式、搜尋 500 ms 與新鮮度 5 分鐘兩個時間預算表、瓶頸說明（每次搜尋查詢所有 shard，節點數以壓測為準），並標明估計值與驗證方式。驗證：人工檢查總表數字與 design.md 一致（S3 約 20 TB、OpenSearch 約 100 億段落／primary 約 25 TB／約 100 TB／1,000 個 primary shard／約 40 台資料節點等），且每個數字都能從題目數字與假設依算式推出。
- [x] 1.3 [after: 1.2] 在 Document storage and metadata storage 一節說明 S3（key 格式、versioning、lifecycle）、Aurora PostgreSQL（中繼資料、正本）、OpenSearch 段落 index（可重建的副本）三者的角色，並用一句話說明中繼資料為什麼不放 S3 metadata。驗證：人工檢查三個儲存各有角色說明，且「正本／副本」關係明確。
- [x] 1.4 [after: 1.3] 在 High-level architecture 一節寫出元件清單（每個元件一句為什麼選它）、「無狀態程式放 EKS、存資料的交給 AWS 託管」的分工、依賴能力而非特定廠商的可替換性說明，以及搜尋、上傳、背景處理三條路徑的簡述；先保留架構圖連結的位置。驗證：人工對照 design.md 的元件清單，每個元件都有一句理由。

## 2. 高層架構圖

- [x] 2.1 [after: 1.4] 使用 archify skill，依 High-level architecture 一節的文字產生高層架構圖，存到 `exercise-2-system-design/diagrams/`：區分 EKS 內的程式與 AWS 託管服務，畫出搜尋、上傳、背景處理三條路徑，只包含 README 提到的元件。驗證：archify 的驗證步驟通過；在瀏覽器開啟圖檔，元件名稱與 README 元件清單逐一對得上，沒有多出或缺少。
- [x] 2.2 [after: 2.1] 在 High-level architecture 一節加入架構圖的相對連結，並在 `exercise-2-system-design/README.md` 中確認連結路徑與實際檔名一致。驗證：從 README 所在目錄解析該相對路徑，檔案存在。

## 3. 收尾

- [x] 3.1 更新根目錄 `README.md` 的 Commit history：把「Exercise 2 — system design」改為依 change 拆開的清單，第一項為「Exercise 2 — assumptions, capacity, architecture」，後兩項為之後的資料流與一致性、營運與討論情境。驗證：人工檢視清單順序與預計的 commit 順序一致。
- [x] 3.2 [after: 2.2, 3.1] 整體檢查：四節符合 design.md 的 Implementation Contract，以及 Decisions 中的「寫作風格：結論優先，一兩句理由」（每個元件或數字先講結論，不展開選項比較）與「數字只到數量級，並註明驗證方式」（估計值有標示，並寫出壓測驗證方式）；`exercise-2-system-design/README.md` 其他章節仍是原本的 TODO；全文英文。驗證：執行 `git diff --stat` 只列出 proposal 的 Impact 中提到的檔案，並人工逐條勾選 Implementation Contract。
