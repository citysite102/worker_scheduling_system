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
