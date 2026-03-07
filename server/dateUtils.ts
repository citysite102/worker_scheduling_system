/**
 * server/dateUtils.ts — 後端台灣時區（UTC+8）工具函式庫
 *
 * 背景說明：
 * - 伺服器時區為 America/New_York（UTC-5），mysql2 驅動在傳遞 Date 物件時使用本地時區序列化
 * - 資料庫中所有時間戳以 UTC 儲存
 * - 後端查詢使用 MySQL CONVERT_TZ(col, '+00:00', '+08:00') 比對台灣時區日期
 * - 所有日期參數應使用 "YYYY-MM-DD" 字串，不傳 Date 物件給 Drizzle ORM
 *
 * 使用規範：
 * - API 輸入的日期字串直接傳給 db.getAssignmentsByTaiwanDate / getAssignmentsByTaiwanDateRange
 * - 需要計算台灣時間的年月日時，使用 getTaiwanDateStr() 系列函式
 * - 後端分組時，使用 utcToTaiwanDateStr() 將 UTC 時間戳轉為台灣日期字串
 */

/** 台灣時區偏移（毫秒） */
const TW_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * 取得台灣時區的當前 Date 物件（UTC 欄位對應台灣時間）
 * 內部使用，不直接傳給 mysql2
 */
export function getTaiwanNow(): Date {
  return new Date(Date.now() + TW_OFFSET_MS);
}

/**
 * 取得台灣時區的今日日期字串（"YYYY-MM-DD"）
 * 用途：後端計算「今日」範圍時使用
 *
 * @example
 * getTaiwanTodayStr() // "2026-03-08"
 */
export function getTaiwanTodayStr(): string {
  const tw = getTaiwanNow();
  return formatDateStr(tw);
}

/**
 * 取得台灣時區的 N 天前日期字串（"YYYY-MM-DD"）
 * 用途：儀表板趨勢圖的起始日期計算
 *
 * @param daysAgo - 往前幾天（0 = 今天）
 * @example
 * getTaiwanDateStrDaysAgo(13) // 13 天前的台灣日期
 */
export function getTaiwanDateStrDaysAgo(daysAgo: number): string {
  const tw = new Date(Date.now() + TW_OFFSET_MS - daysAgo * 24 * 60 * 60 * 1000);
  return formatDateStr(tw);
}

/**
 * 將 UTC 時間戳轉換為台灣時區的日期字串（"YYYY-MM-DD"）
 * 用途：後端分組時，將 scheduledStart（UTC）轉為台灣日期
 *
 * @param utcValue - UTC 時間戳（Date 物件、毫秒數或 ISO 字串）
 * @example
 * utcToTaiwanDateStr(new Date("2026-02-09T01:30:00Z")) // "2026-02-09"
 */
export function utcToTaiwanDateStr(utcValue: Date | number | string): string {
  const ms = typeof utcValue === "string"
    ? new Date(utcValue).getTime()
    : utcValue instanceof Date
      ? utcValue.getTime()
      : utcValue;
  const tw = new Date(ms + TW_OFFSET_MS);
  return formatDateStr(tw);
}

/**
 * 產生從 startDateStr 到 endDateStr 的連續日期字串陣列
 * 用途：趨勢圖的日期 key 初始化
 *
 * @param startDateStr - 起始日期 "YYYY-MM-DD"
 * @param endDateStr - 結束日期 "YYYY-MM-DD"
 */
export function generateDateRange(startDateStr: string, endDateStr: string): string[] {
  const result: string[] = [];
  const [sy, sm, sd] = startDateStr.split("-").map(Number);
  const [ey, em, ed] = endDateStr.split("-").map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  const cur = new Date(start);
  while (cur <= end) {
    result.push(formatDateStr(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return result;
}

/**
 * 內部輔助：將 Date 物件（其 UTC 欄位代表台灣時間）格式化為 "YYYY-MM-DD"
 */
function formatDateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
