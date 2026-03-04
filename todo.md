# Worker Scheduling System Dev - TODO

## 整合任務（從原始專案 citysite102/worker_scheduling_system）

- [x] 安裝原始專案額外依賴套件（bcrypt、nodemailer、@google/generative-ai 等）
- [x] 整合 drizzle/schema.ts（完整資料庫 schema）
- [x] 整合 drizzle/ 遷移 SQL 檔案
- [x] 整合 shared/ 目錄（types、constants、cities、avatars）
- [x] 執行資料庫 schema 遷移（所有資料表已建立）
- [x] 整合 server/db.ts（完整查詢輔助函式）
- [x] 整合 server/businessLogic.ts
- [x] 整合 server/routers.ts（完整 tRPC 路由）
- [x] 整合 server/email.ts
- [x] 整合 server/storage.ts
- [x] 整合 server/password.ts
- [x] 整合 server/gemini-ocr.ts
- [x] 整合 client/src/pages/（所有頁面）
- [x] 整合 client/src/components/（所有元件）
- [x] 整合 client/src/contexts/（ThemeContext 等）
- [x] 整合 client/src/hooks/（自訂 hooks）
- [x] 整合 client/src/lib/（工具函式）
- [x] 整合 client/src/const.ts
- [x] 整合 client/src/index.css
- [x] 整合 client/index.html
- [x] 整合 vite.config.ts
- [x] 整合 tsconfig.json
- [x] 整合 components.json
- [x] 整合 drizzle.config.ts
- [x] 整合 vitest.config.ts
- [x] 整合測試檔案（server/*.test.ts，共 29 個測試檔案）
- [x] 整合 server/test-utils.ts
- [x] 整合 server/clear-test-data.ts
- [x] 整合 seed-data.mjs
- [x] 整合 scripts/ 目錄
- [x] 整合 patches/ 目錄
- [x] 驗證專案可正常啟動（dev server running）
- [x] 驗證核心測試通過（businessLogic、auth、break-hours、conflict-detection 等）
- [x] 儲存 checkpoint

## 後續功能調整

- [x] 在系統名稱後加上「(Beta)」標註
- [x] 在頁面頂部加入測試環境提示 banner
- [x] 指派員工時顯示「許可已過期」員工（加警標籤，管理員端與客戶端同步）
- [x] 客戶 Portal 補上已指派員工資訊與簡易員工資料查看

## 使用者需求（2026/03/01 - GitHub 同步 + Client Onboarding）

- [x] 同步最新程式碼到 GitHub dev branch
- [x] Client 端 Onboarding：server 端加入 onboardingCompleted 欄位與 API
- [x] Client 端 Onboarding：歡迎頁面（首次登入偵測）
- [x] Client 端 Onboarding：步驟式引導流程（功能介紹、操作指引、完成）
- [x] Client 端 Onboarding：完成後標記，不再顯示引導
- [x] Onboarding 完成頁加入「立即建立第一張需求單」 CTA 按鈕，點擊後關閉 Onboarding 並跳轉至需求單建立頁面
- [x] 管理員端客戶帳號管理頁面加入「重置引導」按鈕，重置指定客戶用戶的 Onboarding 狀態

## 測試資料安全隔離（2026/03/01）

- [ ] 分析現有測試架構，找出所有可能污染正式環境的路徑
- [ ] 建立 TEST_ENV 環境守衛機制，阻擋非測試環境執行 seed data
- [ ] 更新 vitest config 加入環境隔離設定
- [ ] 更新 package.json scripts 區分測試與正式環境指令
- [ ] 建立 CI 防護文件說明測試資料隔離策略

## Bug Fix: Admin 代替客戶建立需求單（2026/03/03）

- [x] 修正 demands.create API：Admin 可傳入 clientId 代替客戶建立
- [x] 修正 demands.createBatch API：Admin 可傳入 clientId 代替客戶批次建立
- [x] 更新前端建立需求單頁面：Admin 看到客戶選擇器
- [x] 更新相關測試

## Feature: Admin 需求列表「代建者」標注（2026/03/03）

- [x] 確認 demands API 是否回傳 createdBy 與對應的管理員姓名
- [x] 擴充 API query：JOIN users 取得 createdByName
- [x] 需求列表 UI：代建需求單顯示「由 [管理員姓名] 代建」標注

## Bug Fix: /demands 頁面「需求單不存在」錯誤（2026/03/03）

- [x] 找出 /demands 列表頁觸發「需求單不存在」的 API call
- [x] 修正錯誤

## Feature/Bug: User 角色後台建需求單 + 儀表板 404（2026/03/03）

- [x] 分析 demands.create / createBatch API 對 user 角色的限制
- [x] 後端修正：user 角色可建立需求單（需有 clientId）
- [x] 前端修正：CreateDemand 頁面讓 user 角色正常顯示客戶選擇器
- [x] 修正儀表板 404 問題

## Fix: 建立需求單後跳轉邏輯優化（2026/03/03）

- [x] Admin/User 建立需求單後跳轉到 /demands（後台列表）
- [x] Client 角色維持跳轉到 /client-portal/demands

## Fix: User 角色與 Admin 相同權限（2026/03/03）

- [x] 掃描 routers.ts 所有 admin-only 限制
- [x] 批次修正：clients、workers、demandTypes、schedules 等 API 允許 user 角色操作
- [x] 修正 db.ts createClient 型別缺少 logoUrl 導致建立客戶失敗的 bug

## Bug Fix: 建立客戶 SQL 插入失敗（2026/03/03）

- [x] 分析 createClient SQL 錯誤：contactEmail 被傳入 default 而非 null
- [x] 修正 Clients.tsx billingType 改為受控 state，解決 shadcn Select 不支援 name 屬性的問題

## Feature: 移除客戶功能（2026/03/03）

- [x] 後端加入 clients.delete API（含關聯資料檢查）
- [x] 前端客戶列表加入刪除按鈕
- [x] 前端加入確認對話框（防止誤刪）

## Feature: 移除員工功能（2026/03/03）

- [x] 後端加入 workers.delete API（含進行中排班記錄檢查）
- [x] 前端員工列表加入刪除按鈕
- [x] 前端加入確認對話框（防止誤刪）

## Testing: 角色權限系統性測試（2026/03/03）

- [x] 測試 user 角色：員工管理（新增/編輯/刪除/停用）
- [x] 測試 user 角色：客戶管理（新增/編輯/刪除/停用）
- [x] 測試 user 角色：需求單操作（建立/審核/指派）
- [x] 測試 client 角色：建立需求單
- [x] 測試 client 角色：查看自己的需求單
- [x] 測試 client 角色：取消需求單
- [x] 修正測試中發現的所有問題

## Bug Fix: 新增員工 Select 欄位第一次無法儲存（2026/03/03）

- [x] 分析 Workers.tsx 新增員工表單的 idType 等 Select 欄位傳遞問題
- [x] 修正 idNumber → uiNumber 欄位名稱不一致，並將 city Select 改為受控 state

## Audit: 前後端欄位名稱一致性全面審查（2026/03/04）

- [x] 掃描所有使用 formData.get() 的前端頁面
- [x] 對照後端 router schema，找出所有不一致欄位
- [x] 修正所有發現的問題
  - [x] ClientDetail.tsx: billingType/status/breakHours Select 改為受控 state
  - [x] DemandDetail.tsx: clientId Select 改為受控 state
  - [x] client-portal/CreateDemand.tsx: demandTypeId 改用 selectedDemandTypeId state
  - [x] client-portal/DemandDetail.tsx: demandTypeId 改用 selectedDemandTypeId state
  - [x] 統一 idNumber 欄位名稱：routers.ts create/batchCreate、db.ts、Workers.tsx、BatchWorkPermitUpload.tsx、exportWorkers.ts
