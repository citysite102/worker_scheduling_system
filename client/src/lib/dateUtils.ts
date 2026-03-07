/**
 * dateUtils.ts — 台灣時區（UTC+8）工具函式庫
 *
 * 背景說明：
 * - 伺服器時區為 America/New_York（UTC-5），mysql2 驅動在傳遞 Date 物件時使用本地時區序列化
 * - 資料庫中所有時間戳以 UTC 儲存（scheduledStart 等欄位）
 * - 後端查詢使用 MySQL CONVERT_TZ(col, '+00:00', '+08:00') 比對台灣時區日期
 * - 前端應傳遞 "YYYY-MM-DD" 字串而非 Date 物件，避免時區序列化問題
 *
 * 使用規範：
 * - 所有日期查詢參數一律傳遞字串（"YYYY-MM-DD"），不傳 Date 物件
 * - 顯示日期時使用 formatTaiwanDate() 而非 new Date(str).toLocaleDateString()
 * - 取得今日日期使用 getTaiwanTodayStr() 而非 new Date().toISOString().split("T")[0]
 */

/** 台灣時區偏移（毫秒） */
const TW_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * 取得台灣時區的當前 Date 物件（UTC 日期欄位對應台灣時間）
 * 用途：計算台灣時間的年月日，不直接用於 API 傳遞
 */
export function getTaiwanNow(): Date {
  return new Date(Date.now() + TW_OFFSET_MS);
}

/**
 * 取得台灣時區的今日日期字串（"YYYY-MM-DD"）
 * 用途：作為日期選擇器的初始值、API 查詢的預設日期
 *
 * @example
 * const today = getTaiwanTodayStr(); // "2026-03-08"
 */
export function getTaiwanTodayStr(): string {
  const tw = getTaiwanNow();
  const y = tw.getUTCFullYear();
  const m = String(tw.getUTCMonth() + 1).padStart(2, "0");
  const d = String(tw.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 取得台灣時區的本月第一天日期字串（"YYYY-MM-DD"）
 * 用途：報表月份篩選的預設起始日
 *
 * @example
 * const firstDay = getTaiwanMonthStartStr(); // "2026-03-01"
 */
export function getTaiwanMonthStartStr(): string {
  const tw = getTaiwanNow();
  const y = tw.getUTCFullYear();
  const m = String(tw.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/**
 * 取得台灣時區的本月最後一天日期字串（"YYYY-MM-DD"）
 * 用途：報表月份篩選的預設結束日
 *
 * @example
 * const lastDay = getTaiwanMonthEndStr(); // "2026-03-31"
 */
export function getTaiwanMonthEndStr(): string {
  const tw = getTaiwanNow();
  const y = tw.getUTCFullYear();
  const m = tw.getUTCMonth(); // 0-indexed
  // 下個月第 0 天 = 本月最後一天
  const lastDay = new Date(Date.UTC(y, m + 1, 0));
  const mm = String(lastDay.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(lastDay.getUTCDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/**
 * 將 UTC 時間戳轉換為台灣時區的日期字串（"YYYY-MM-DD"）
 * 用途：將資料庫回傳的時間戳轉為台灣日期，用於分組或顯示
 *
 * @param utcTimestamp - UTC 時間戳（毫秒）或 Date 物件
 * @example
 * utcToTaiwanDateStr(new Date("2026-02-09T01:30:00Z")) // "2026-02-09"
 */
export function utcToTaiwanDateStr(utcTimestamp: Date | number | string): string {
  const ms = typeof utcTimestamp === "string"
    ? new Date(utcTimestamp).getTime()
    : utcTimestamp instanceof Date
      ? utcTimestamp.getTime()
      : utcTimestamp;
  const tw = new Date(ms + TW_OFFSET_MS);
  const y = tw.getUTCFullYear();
  const m = String(tw.getUTCMonth() + 1).padStart(2, "0");
  const d = String(tw.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 將 "YYYY-MM-DD" 日期字串格式化為台灣慣用顯示格式
 * 用途：頁面標題、卡片日期顯示，避免 new Date(str).toLocaleDateString() 的時區陷阱
 *
 * @param dateStr - "YYYY-MM-DD" 格式的日期字串
 * @param format - 輸出格式，預設 "zh-TW"（2026/3/8），可選 "short"（3/8）、"full"（2026年3月8日）
 * @example
 * formatTaiwanDate("2026-02-09")          // "2026/2/9"
 * formatTaiwanDate("2026-02-09", "short") // "2/9"
 * formatTaiwanDate("2026-02-09", "full")  // "2026年2月9日"
 */
export function formatTaiwanDate(
  dateStr: string,
  format: "zh-TW" | "short" | "full" = "zh-TW"
): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  switch (format) {
    case "short":
      return `${m}/${d}`;
    case "full":
      return `${y}年${m}月${d}日`;
    case "zh-TW":
    default:
      return `${y}/${m}/${d}`;
  }
}

/**
 * 將 UTC 時間戳轉換為台灣時區的時間字串（"HH:mm"）
 * 用途：顯示排班的實際開始/結束時間（台灣時間）
 *
 * @param utcTimestamp - UTC 時間戳或 Date 物件
 * @example
 * utcToTaiwanTimeStr(new Date("2026-02-09T01:30:00Z")) // "09:30"
 */
export function utcToTaiwanTimeStr(utcTimestamp: Date | number | string): string {
  const ms = typeof utcTimestamp === "string"
    ? new Date(utcTimestamp).getTime()
    : utcTimestamp instanceof Date
      ? utcTimestamp.getTime()
      : utcTimestamp;
  const tw = new Date(ms + TW_OFFSET_MS);
  const h = String(tw.getUTCHours()).padStart(2, "0");
  const min = String(tw.getUTCMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

/**
 * 取得台灣時區的 N 天前日期字串（"YYYY-MM-DD"）
 * 用途：儀表板趨勢圖的起始日期計算
 *
 * @param daysAgo - 往前幾天（0 = 今天，1 = 昨天）
 * @example
 * getTaiwanDateStrDaysAgo(13) // 13 天前的台灣日期
 */
export function getTaiwanDateStrDaysAgo(daysAgo: number): string {
  const tw = new Date(Date.now() + TW_OFFSET_MS - daysAgo * 24 * 60 * 60 * 1000);
  const y = tw.getUTCFullYear();
  const m = String(tw.getUTCMonth() + 1).padStart(2, "0");
  const d = String(tw.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 產生從 startDateStr 到 endDateStr 的連續日期字串陣列
 * 用途：儀表板趨勢圖的 X 軸日期標籤
 *
 * @param startDateStr - 起始日期 "YYYY-MM-DD"
 * @param endDateStr - 結束日期 "YYYY-MM-DD"
 * @example
 * generateDateRange("2026-03-01", "2026-03-03") // ["2026-03-01", "2026-03-02", "2026-03-03"]
 */
export function generateDateRange(startDateStr: string, endDateStr: string): string[] {
  const result: string[] = [];
  const [sy, sm, sd] = startDateStr.split("-").map(Number);
  const [ey, em, ed] = endDateStr.split("-").map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cur.getUTCDate()).padStart(2, "0");
    result.push(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return result;
}

/**
 * 比較兩個日期字串的大小
 * 用途：排序、範圍驗證
 *
 * @returns 負數（a < b）、0（相等）、正數（a > b）
 */
export function compareDateStr(a: string, b: string): number {
  return a.localeCompare(b);
}
