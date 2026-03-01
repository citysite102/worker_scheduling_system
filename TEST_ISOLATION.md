# 測試資料隔離策略

本文件說明本專案如何確保測試資料**只在測試環境中生成**，不會影響正式環境的資料庫。

---

## 核心原則

所有會寫入資料庫的測試操作，必須同時滿足以下三個條件才能執行：

1. `NODE_ENV` 不是 `production`
2. 執行環境是 vitest（`VITEST=true`）
3. 已設定 `TEST_DATABASE_URL`（指向測試專用資料庫）

---

## 三層防護機制

### 第一層：`server/test-env-guard.ts`

所有測試的 `beforeAll` 必須呼叫 `assertTestEnvironment()`，確認環境正確後才能繼續。

```ts
import { assertTestEnvironment } from "./test-env-guard";

beforeAll(async () => {
  assertTestEnvironment(); // 若不在測試環境，立即拋出錯誤
  // ... 其他初始化
});
```

### 第二層：`seed-data.mjs` 環境守衛

`seed-data.mjs` 在執行前會檢查：
- 若 `NODE_ENV=production`，立即退出
- 若未設定 `TEST_DATABASE_URL`，立即退出
- 通過檢查後，使用 `TEST_DATABASE_URL` 連線，而非 `DATABASE_URL`

### 第三層：`server/clear-test-data.ts` 環境守衛

`clear-test-data.ts` 在執行全表清空前會檢查：
- 若 `NODE_ENV=production`，拋出錯誤阻止執行
- 若未設定 `TEST_DATABASE_URL`，拋出錯誤阻止執行

---

## 環境設定

### 本地測試環境設定

1. 複製範本檔案：
   ```bash
   cp .env.test.example .env.test
   ```

2. 編輯 `.env.test`，填入測試專用資料庫連線：
   ```
   TEST_DATABASE_URL=mysql://user:pass@localhost:3306/worker_scheduling_test
   ```

3. `.env.test` 已加入 `.gitignore`，不會被提交到 Git。

### CI/CD 環境設定

在 GitHub Repository Settings → Secrets 中設定：
- `TEST_DATABASE_URL`：測試專用資料庫連線字串

---

## 可用的 npm scripts

| 指令 | 說明 | 是否需要資料庫 |
|---|---|---|
| `pnpm test` | 執行所有測試（需要 .env.test） | 是（TEST_DATABASE_URL） |
| `pnpm test:unit` | 只執行純邏輯單元測試 | 否 |
| `pnpm test:db` | 執行資料庫整合測試（載入 .env.test） | 是（TEST_DATABASE_URL） |
| `pnpm seed` | 執行 seed data（載入 .env.test） | 是（TEST_DATABASE_URL） |
| `pnpm db:clear` | 清除測試資料（載入 .env.test） | 是（TEST_DATABASE_URL） |

---

## CI/CD 流程

```
PR 到 dev branch
  └─ 執行 unit-tests（無資料庫）
  └─ 執行 integration-tests（使用 TEST_DATABASE_URL secret）

PR 到 main branch
  └─ 只執行 unit-tests（無資料庫）
  └─ 不執行資料庫整合測試
  └─ 不執行 seed data
  └─ 不影響正式環境資料庫
```

---

## 常見問題

**Q：為什麼不直接用 DATABASE_URL 執行測試？**

A：`DATABASE_URL` 指向正式環境資料庫。若測試直接使用 `DATABASE_URL`，測試資料（包含 `DELETE FROM` 清空操作）會直接影響正式環境，造成資料損失。

**Q：`pnpm test` 在 CI 的 main branch 會失敗嗎？**

A：不會。CI 設定中，main branch 只執行 `pnpm test:unit`（純邏輯測試），不需要資料庫連線，也不會生成任何測試資料。

**Q：如何在本地執行完整的資料庫整合測試？**

A：設定好 `.env.test` 後，執行 `pnpm test:db`。
