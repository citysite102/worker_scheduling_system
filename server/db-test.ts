/**
 * 測試專用資料庫連線模組（Test Database Connection）
 *
 * 此模組提供測試環境專用的資料庫連線，
 * 使用 TEST_DATABASE_URL 而非正式環境的 DATABASE_URL，
 * 確保測試資料完全隔離於正式環境之外。
 *
 * 重要：此模組只能在測試檔案（*.test.ts）中引用，
 * 不得在正式的 server 程式碼中引用。
 */

import { drizzle } from "drizzle-orm/mysql2";
import { assertTestEnvironment } from "./test-env-guard";

let _testDb: ReturnType<typeof drizzle> | null = null;

/**
 * 取得測試專用的 Drizzle 資料庫連線。
 * 每次呼叫都會先執行環境守衛檢查。
 *
 * @throws {Error} 若不在測試環境或未設定 TEST_DATABASE_URL
 */
export async function getTestDb() {
  // 每次呼叫都執行守衛，確保環境正確
  assertTestEnvironment();

  if (!_testDb) {
    const testUrl = process.env.TEST_DATABASE_URL!;
    try {
      _testDb = drizzle(testUrl);
    } catch (error) {
      console.error("[Test DB] 無法連線到測試資料庫:", error);
      throw error;
    }
  }
  return _testDb;
}

/**
 * 重置測試資料庫連線（用於測試套件結束後清理）
 */
export function resetTestDb(): void {
  _testDb = null;
}
