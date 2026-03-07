import { describe, expect, it } from "vitest";
import { isTimeOverlap, combineDateAndTime, getWeekStart, formatDate, formatTime, calculateMinutesBetween } from "./businessLogic";
import { cleanupTestData, TestDataIds } from "./test-utils";

describe("businessLogic", () => {
  describe("isTimeOverlap", () => {
    it("應該正確檢測時段重疊", () => {
      const start1 = new Date("2026-02-09T09:00:00");
      const end1 = new Date("2026-02-09T17:00:00");
      const start2 = new Date("2026-02-09T14:00:00");
      const end2 = new Date("2026-02-09T18:00:00");

      expect(isTimeOverlap(start1, end1, start2, end2)).toBe(true);
    });

    it("應該正確檢測時段不重疊", () => {
      const start1 = new Date("2026-02-09T09:00:00");
      const end1 = new Date("2026-02-09T12:00:00");
      const start2 = new Date("2026-02-09T14:00:00");
      const end2 = new Date("2026-02-09T18:00:00");

      expect(isTimeOverlap(start1, end1, start2, end2)).toBe(false);
    });

    it("應該正確檢測時段邊界接觸（不算重疊）", () => {
      const start1 = new Date("2026-02-09T09:00:00");
      const end1 = new Date("2026-02-09T14:00:00");
      const start2 = new Date("2026-02-09T14:00:00");
      const end2 = new Date("2026-02-09T18:00:00");

      expect(isTimeOverlap(start1, end1, start2, end2)).toBe(false);
    });
  });

  describe("combineDateAndTime", () => {
    it("應該正確組合日期與時間", () => {
      const date = new Date("2026-02-09T00:00:00+08:00");
      const time = "14:30";

      const result = combineDateAndTime(date, time);

      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });
  });

  describe("getWeekStart", () => {
    it("應該取得週一日期（週三輸入）", () => {
      const date = new Date("2026-02-11"); // 週三

      const result = getWeekStart(date);

      expect(result.getUTCDay()).toBe(1); // 週一
      expect(result.getUTCDate()).toBe(9); // 2026/02/09 是週一
    });

    it("應該取得週一日期（週日輸入）", () => {
      const date = new Date("2026-02-15"); // 週日

      const result = getWeekStart(date);

      expect(result.getUTCDay()).toBe(1); // 週一
      expect(result.getUTCDate()).toBe(9); // 2026/02/09 是週一
    });

    it("應該取得週一日期（週一輸入）", () => {
      const date = new Date("2026-02-09T12:00:00+08:00"); // 週一

      const result = getWeekStart(date);

      expect(result.getUTCDay()).toBe(1); // 週一
    });
  });

  describe("formatDate", () => {
    it("應該格式化日期為 YYYY/MM/DD", () => {
      const date = new Date(2026, 1, 9); // 使用 Date 建構子避免時區問題

      const result = formatDate(date);

      expect(result).toBe("2026/2/9 星期一");
    });
  });

  describe("formatTime", () => {
    it("應該格式化時間為 HH:mm", () => {
      // 使用 UTC 時間字串（帶 Z 後綴），符合資料庫回傳的實際格式
      const date = new Date("2026-02-09T14:30:00Z");

      const result = formatTime(date);

      expect(result).toBe("14:30");
    });

    it("應該正確補零", () => {
      // 使用 UTC 時間字串（帶 Z 後綴），符合資料庫回傳的實際格式
      const date = new Date("2026-02-09T09:05:00Z");

      const result = formatTime(date);

      expect(result).toBe("09:05");
    });
  });

  describe("calculateMinutesBetween", () => {
    it("應該正確計算分鐘數", () => {
      const start = new Date("2026-02-09T09:00:00");
      const end = new Date("2026-02-09T17:00:00");

      const result = calculateMinutesBetween(start, end);

      expect(result).toBe(480); // 8 小時 = 480 分鐘
    });

    it("應該正確計算半小時", () => {
      const start = new Date("2026-02-09T09:00:00");
      const end = new Date("2026-02-09T09:30:00");

      const result = calculateMinutesBetween(start, end);

      expect(result).toBe(30);
    });
  });
});
