import { describe, it, expect } from "vitest";

/**
 * invertTimeSlots 邏輯測試
 * 此函式在前端 Availability.tsx 中使用，將「不能工作的時段」轉換為「可以工作的時段」
 * 這裡複製純函式邏輯進行測試，確保轉換結果正確
 */

function invertTimeSlots(
  blockedSlots: { startTime: string; endTime: string }[]
): { startTime: string; endTime: string }[] {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const toTime = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const DAY_START = 0;
  const DAY_END = 24 * 60;

  const validBlocked = blockedSlots
    .filter((s) => toMin(s.startTime) < toMin(s.endTime))
    .map((s) => ({ start: toMin(s.startTime), end: toMin(s.endTime) }))
    .sort((a, b) => a.start - b.start);

  if (validBlocked.length === 0) {
    return [{ startTime: "00:00", endTime: "24:00" }];
  }

  const merged: { start: number; end: number }[] = [];
  for (const slot of validBlocked) {
    if (merged.length === 0 || slot.start >= merged[merged.length - 1].end) {
      merged.push({ ...slot });
    } else {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, slot.end);
    }
  }

  const available: { startTime: string; endTime: string }[] = [];
  let cursor = DAY_START;

  for (const block of merged) {
    if (cursor < block.start) {
      available.push({ startTime: toTime(cursor), endTime: toTime(block.start) });
    }
    cursor = block.end;
  }

  if (cursor < DAY_END) {
    available.push({ startTime: toTime(cursor), endTime: toTime(DAY_END) });
  }

  return available;
}

describe("invertTimeSlots 反向模式時段轉換", () => {
  it("封鎖時段為空 → 整天可工作 00:00–24:00", () => {
    const result = invertTimeSlots([]);
    expect(result).toEqual([{ startTime: "00:00", endTime: "24:00" }]);
  });

  it("封鎖午休 12:00–13:00 → 上下午各一段", () => {
    const result = invertTimeSlots([{ startTime: "12:00", endTime: "13:00" }]);
    expect(result).toEqual([
      { startTime: "00:00", endTime: "12:00" },
      { startTime: "13:00", endTime: "24:00" },
    ]);
  });

  it("封鎖整天 00:00–24:00 → 沒有可工作時段", () => {
    const result = invertTimeSlots([{ startTime: "00:00", endTime: "24:00" }]);
    expect(result).toEqual([]);
  });

  it("封鎖一天開頭 00:00–09:00 → 只剩下午", () => {
    const result = invertTimeSlots([{ startTime: "00:00", endTime: "09:00" }]);
    expect(result).toEqual([{ startTime: "09:00", endTime: "24:00" }]);
  });

  it("封鎖一天結尾 18:00–24:00 → 只剩上午到傍晚", () => {
    const result = invertTimeSlots([{ startTime: "18:00", endTime: "24:00" }]);
    expect(result).toEqual([{ startTime: "00:00", endTime: "18:00" }]);
  });

  it("多個封鎖時段（不連續）→ 多個可工作時段", () => {
    const result = invertTimeSlots([
      { startTime: "12:00", endTime: "13:00" },
      { startTime: "17:00", endTime: "18:00" },
    ]);
    expect(result).toEqual([
      { startTime: "00:00", endTime: "12:00" },
      { startTime: "13:00", endTime: "17:00" },
      { startTime: "18:00", endTime: "24:00" },
    ]);
  });

  it("多個封鎖時段（連續/重疊）→ 合併後計算", () => {
    const result = invertTimeSlots([
      { startTime: "09:00", endTime: "12:00" },
      { startTime: "11:00", endTime: "14:00" }, // 與上一段重疊
    ]);
    expect(result).toEqual([
      { startTime: "00:00", endTime: "09:00" },
      { startTime: "14:00", endTime: "24:00" },
    ]);
  });

  it("封鎖時段順序不同 → 排序後正確計算", () => {
    const result = invertTimeSlots([
      { startTime: "17:00", endTime: "18:00" },
      { startTime: "12:00", endTime: "13:00" },
    ]);
    expect(result).toEqual([
      { startTime: "00:00", endTime: "12:00" },
      { startTime: "13:00", endTime: "17:00" },
      { startTime: "18:00", endTime: "24:00" },
    ]);
  });

  it("開始時間 >= 結束時間的無效時段 → 自動過濾，視為無封鎖", () => {
    const result = invertTimeSlots([{ startTime: "13:00", endTime: "12:00" }]);
    expect(result).toEqual([{ startTime: "00:00", endTime: "24:00" }]);
  });

  it("封鎖中段 08:00–17:00 → 早晨與晚上各一段", () => {
    const result = invertTimeSlots([{ startTime: "08:00", endTime: "17:00" }]);
    expect(result).toEqual([
      { startTime: "00:00", endTime: "08:00" },
      { startTime: "17:00", endTime: "24:00" },
    ]);
  });
});
