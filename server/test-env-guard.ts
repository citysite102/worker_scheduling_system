/**
 * 測試環境守衛（Test Environment Guard）
 *
 * 這個模組確保任何會寫入資料庫的測試操作，
 * 只能在明確標記為「測試環境」的情況下執行。
 *
 * 防護機制：
 * 1. 必須設定 TEST_DATABASE_URL 環境變數（與正式環境 DATABASE_URL 完全分離）
 * 2. 必須在 vitest 執行環境中（import.meta.vitest 或 VITEST 環境變數）
 * 3. 不允許在 NODE_ENV=production 下執行任何測試資料操作
 *
 * 使用方式：
 *   在任何測試的 beforeAll/beforeEach 最頂端呼叫 assertTestEnvironment()
 */

/**
 * 確認目前執行環境為測試環境，否則拋出錯誤阻止執行。
 *
 * @throws {Error} 若不在測試環境或未設定 TEST_DATABASE_URL
 */
export function assertTestEnvironment(): void {
  // 防線 1：禁止在 production 環境執行
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[TEST GUARD] ❌ 禁止在 production 環境執行測試資料操作。\n" +
      "NODE_ENV=production 時，所有測試資料寫入操作均被封鎖。"
    );
  }

  // 防線 2：必須在 vitest 執行環境中
  const isVitest = process.env.VITEST === "true" || process.env.VITEST === "1";
  if (!isVitest) {
    throw new Error(
      "[TEST GUARD] ❌ 測試資料操作只能在 vitest 執行環境中進行。\n" +
      "請使用 pnpm test 或 pnpm test:db 執行測試，不要直接執行測試檔案。"
    );
  }

  // 防線 3：必須設定 TEST_DATABASE_URL（獨立測試資料庫連線）
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      "[TEST GUARD] ❌ 未設定 TEST_DATABASE_URL 環境變數。\n" +
      "請在 .env.test 中設定 TEST_DATABASE_URL 指向測試專用資料庫，\n" +
      "不要讓測試直接使用正式環境的 DATABASE_URL。\n\n" +
      "範例 .env.test 設定：\n" +
      "  TEST_DATABASE_URL=mysql://user:pass@localhost:3306/worker_scheduling_test"
    );
  }
}

/**
 * 取得測試專用的資料庫連線字串。
 * 若未設定 TEST_DATABASE_URL，回傳 null（測試將被跳過）。
 */
export function getTestDatabaseUrl(): string | null {
  return process.env.TEST_DATABASE_URL ?? null;
}

/**
 * 檢查目前是否在測試環境（不拋出錯誤，回傳 boolean）。
 * 適合用於 describe.skipIf 或 it.skipIf 的條件判斷。
 */
export function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.VITEST === "true" || process.env.VITEST === "1") &&
    !!process.env.TEST_DATABASE_URL
  );
}
