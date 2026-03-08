/**
 * actual-time-week-view.test.ts
 * 測試實際工時回填週視圖功能的業務邏輯
 */
import { describe, expect, it } from "vitest";

// ============ dateUtils 週視圖工具函式測試 ============

/**
 * 複製前端 dateUtils 的週一計算邏輯（伺服器端驗證）
 */
function getTaiwanWeekStartStr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const tw = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = tw.getUTCDay(); // 0=日, 1=一, ..., 6=六
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(tw);
  monday.setUTCDate(monday.getUTCDate() - daysToMonday);
  const ny = monday.getUTCFullYear();
  const nm = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(monday.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  const ny = date.getUTCFullYear();
  const nm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(date.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

function getWeekdayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return ["日", "一", "二", "三", "四", "五", "六"][date.getUTCDay()];
}

function generateWeekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysToDateStr(weekStart, i));
}

describe("week view date utilities", () => {
  describe("getTaiwanWeekStartStr", () => {
    it("returns Monday for a Wednesday input", () => {
      // 2026-03-11 是星期三
      expect(getTaiwanWeekStartStr("2026-03-11")).toBe("2026-03-09");
    });

    it("returns Monday for a Monday input", () => {
      // 2026-03-09 是星期一
      expect(getTaiwanWeekStartStr("2026-03-09")).toBe("2026-03-09");
    });

    it("returns previous Monday for a Sunday input", () => {
      // 2026-03-08 是星期日，應回傳上週一 2026-03-02
      expect(getTaiwanWeekStartStr("2026-03-08")).toBe("2026-03-02");
    });

    it("returns Monday for a Saturday input", () => {
      // 2026-03-07 是星期六
      expect(getTaiwanWeekStartStr("2026-03-07")).toBe("2026-03-02");
    });

    it("handles month boundary correctly", () => {
      // 2026-03-01 是星期日，應回傳 2026-02-23（上週一）
      expect(getTaiwanWeekStartStr("2026-03-01")).toBe("2026-02-23");
    });

    it("handles year boundary correctly", () => {
      // 2026-01-01 是星期四，週一應為 2025-12-29
      expect(getTaiwanWeekStartStr("2026-01-01")).toBe("2025-12-29");
    });
  });

  describe("addDaysToDateStr", () => {
    it("adds 7 days to get next week start", () => {
      expect(addDaysToDateStr("2026-03-02", 7)).toBe("2026-03-09");
    });

    it("subtracts 7 days to get previous week start", () => {
      expect(addDaysToDateStr("2026-03-09", -7)).toBe("2026-03-02");
    });

    it("handles month boundary when adding days", () => {
      expect(addDaysToDateStr("2026-03-28", 7)).toBe("2026-04-04");
    });

    it("handles year boundary when subtracting days", () => {
      expect(addDaysToDateStr("2026-01-03", -7)).toBe("2025-12-27");
    });
  });

  describe("getWeekdayLabel", () => {
    it("returns correct weekday for known dates", () => {
      expect(getWeekdayLabel("2026-03-09")).toBe("一"); // 週一
      expect(getWeekdayLabel("2026-03-10")).toBe("二"); // 週二
      expect(getWeekdayLabel("2026-03-11")).toBe("三"); // 週三
      expect(getWeekdayLabel("2026-03-12")).toBe("四"); // 週四
      expect(getWeekdayLabel("2026-03-13")).toBe("五"); // 週五
      expect(getWeekdayLabel("2026-03-14")).toBe("六"); // 週六
      expect(getWeekdayLabel("2026-03-15")).toBe("日"); // 週日
    });
  });

  describe("generateWeekDays", () => {
    it("generates 7 days starting from Monday", () => {
      const days = generateWeekDays("2026-03-09");
      expect(days).toHaveLength(7);
      expect(days[0]).toBe("2026-03-09"); // 週一
      expect(days[6]).toBe("2026-03-15"); // 週日
    });

    it("generates correct days across month boundary", () => {
      const days = generateWeekDays("2026-03-30");
      expect(days[0]).toBe("2026-03-30");
      expect(days[2]).toBe("2026-04-01");
      expect(days[6]).toBe("2026-04-05");
    });
  });
});

// ============ 週視圖分組邏輯測試 ============

describe("week view grouping logic", () => {
  it("groups assignments by taiwanDateStr correctly", () => {
    const mockAssignments = [
      { id: 1, taiwanDateStr: "2026-03-09", worker: { name: "Alice" } },
      { id: 2, taiwanDateStr: "2026-03-09", worker: { name: "Bob" } },
      { id: 3, taiwanDateStr: "2026-03-10", worker: { name: "Charlie" } },
    ];

    const grouped: Record<string, typeof mockAssignments> = {};
    for (const a of mockAssignments) {
      if (!grouped[a.taiwanDateStr]) grouped[a.taiwanDateStr] = [];
      grouped[a.taiwanDateStr].push(a);
    }

    expect(grouped["2026-03-09"]).toHaveLength(2);
    expect(grouped["2026-03-10"]).toHaveLength(1);
    expect(grouped["2026-03-11"]).toBeUndefined();
  });

  it("calculates week stats correctly", () => {
    const mockAssignments = [
      { id: 1, status: "completed", role: "regular", payAmount: 1600 },
      { id: 2, status: "assigned", role: "regular", payAmount: null },
      { id: 3, status: "completed", role: "intern", payAmount: null },
      { id: 4, status: "disputed", role: "regular", payAmount: 800 },
    ];

    const total = mockAssignments.length;
    const completed = mockAssignments.filter(a => a.status === "completed" || a.status === "disputed").length;
    const pending = total - completed;
    const payrollPending = mockAssignments.filter(a => a.role !== "intern" && (a.payAmount === null || a.payAmount === undefined)).length;

    expect(total).toBe(4);
    expect(completed).toBe(3);
    expect(pending).toBe(1);
    expect(payrollPending).toBe(1); // id:2 正職薪資未填
  });
});
