# 測試失敗分析報告

## 測試執行摘要

**測試檔案**：11 失敗 | 10 通過（21 個）  
**測試案例**：約 12 失敗 | 約 111 通過（總計約 123 個）  
**通過率**：約 90.2%

## 失敗原因分類

### 類別 1：測試資料隔離問題（外鍵約束錯誤）

這些測試在清理資料時遇到外鍵約束錯誤，主要是因為沒有按正確順序刪除相關資料。

**影響的測試檔案**：
1. **auto-status-update.test.ts** - 刪除 clients 時有 demands 依賴
2. **comprehensive-time-logic.test.ts** - 刪除 workers 時有 assignments/availability 依賴
3. **core-workflow.test.ts** - 刪除 clients 時有 demands 依賴
4. **demand-workflows.test.ts** - 刪除 demands 時有 assignments 依賴

**修復方式**：使用統一的 `cleanupTestData` 機制

### 類別 2：變數未定義錯誤

測試中使用了未定義的變數，導致 ReferenceError。

**影響的測試檔案**：
1. **conflict-detection.test.ts** - `testDemand1Id is not defined`
2. **end-to-end-report.test.ts** - `testWorker1Id is not defined`, `testAssignment1Id is not defined`
3. **test-availability-flow.test.ts** - `afterAll is not defined`

**修復方式**：
- 在測試檔案頂部宣告變數
- 或使用 `testDataIds` 物件追蹤
- 修復 `afterAll` 的 import

### 類別 3：業務邏輯變更導致的斷言錯誤

測試預期與實際系統行為不符，主要是需求單狀態自動更新邏輯的變更。

**影響的測試檔案**：
1. **auto-close-demand.test.ts** - 需求單狀態預期 `confirmed` 但實際為 `draft`
2. **auto-status-update.test.ts** - 需求單狀態預期 `draft` 但實際為 `confirmed`
3. **break-hours.test.ts** - 報表資料為空陣列（預期有 1 筆）

**修復方式**：
- 檢查當前業務邏輯
- 更新測試預期值以符合實際行為
- 或修復業務邏輯以符合測試預期

## 修復優先順序

### 高優先級（快速修復）

1. **修復變數未定義錯誤**（3 個測試檔案）
   - conflict-detection.test.ts
   - end-to-end-report.test.ts
   - test-availability-flow.test.ts
   - 預計時間：10-15 分鐘

2. **使用 cleanupTestData 修復資料隔離問題**（4 個測試檔案）
   - auto-status-update.test.ts
   - comprehensive-time-logic.test.ts
   - core-workflow.test.ts
   - demand-workflows.test.ts
   - 預計時間：15-20 分鐘

### 中優先級（需要分析）

3. **修復業務邏輯斷言錯誤**（3 個測試檔案）
   - auto-close-demand.test.ts
   - auto-status-update.test.ts
   - break-hours.test.ts
   - 預計時間：20-30 分鐘

## 預期修復成果

- **修復後通過率**：預計 95-100%
- **修復後測試檔案**：預計 19-21 個通過
- **修復後測試案例**：預計 120-123 個通過
