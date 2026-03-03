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
