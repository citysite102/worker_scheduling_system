import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

/**
 * 完整測試排班設置與需求單指派流程
 * 
 * 測試場景：
 * 1. 為員工「慕伊娜Ina」設定本週（2026/02/09 - 2026/02/15）的排班時間
 *    - 週一（02/09）：09:00 - 17:00
 *    - 週四（02/13）：09:00 - 17:00
 * 2. 確認本週排班
 * 3. 檢查需求單「米窩-中山館」（2026/2/13 週四 09:00 - 16:00）的員工可用性
 * 4. 驗證慕伊娜應該可以被指派
 */

describe("排班設置與需求單指派完整流程測試", () => {
  const workerId = 30001; // 慕伊娜Ina
  const demandId = 30001; // 米窩-中山館
  const weekStart = new Date("2026-02-09T00:00:00.000Z");
  const demandDate = new Date("2026-02-13T00:00:00.000Z");
  const demandStartTime = "09:00";
  const demandEndTime = "16:00";

  beforeAll(async () => {
    // 清除測試資料
    const dbInstance = await db.getDb();
    if (!dbInstance) throw new Error("Database not available");
    
    const { availability } = await import("../drizzle/schema");
    const { and, eq, gte, lt } = await import("drizzle-orm");
    
    const dayStart = new Date(weekStart);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 7);
    
    await dbInstance.delete(availability).where(
      and(
        eq(availability.workerId, workerId),
        gte(availability.weekStartDate, dayStart),
        lt(availability.weekStartDate, dayEnd)
      )
    );
  });

  it("步驟 1：設定週一的排班時間", async () => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const timeBlocks = [
      {
        dayOfWeek: 1, // 週一
        timeSlots: [{ startTime: "09:00", endTime: "17:00" }],
      },
    ];
    
    await db.upsertAvailability({
      workerId,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      timeBlocks: JSON.stringify(timeBlocks),
      confirmedAt: null,
    });
    
    const result = await db.getAvailabilityByWorkerAndWeek(workerId, weekStart);
    expect(result).toBeDefined();
    expect(result?.confirmedAt).toBeNull();
    
    const blocks = JSON.parse(result?.timeBlocks || "[]");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].dayOfWeek).toBe(1);
  });

  it("步驟 2：設定週四的排班時間", async () => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    // 先取得現有記錄
    const existing = await db.getAvailabilityByWorkerAndWeek(workerId, weekStart);
    const existingBlocks = JSON.parse(existing?.timeBlocks || "[]");
    
    // 加入週四的排班
    const timeBlocks = [
      ...existingBlocks,
      {
        dayOfWeek: 4, // 週四
        timeSlots: [{ startTime: "09:00", endTime: "17:00" }],
      },
    ];
    
    await db.upsertAvailability({
      workerId,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      timeBlocks: JSON.stringify(timeBlocks),
      confirmedAt: existing?.confirmedAt || null,
    });
    
    const result = await db.getAvailabilityByWorkerAndWeek(workerId, weekStart);
    const blocks = JSON.parse(result?.timeBlocks || "[]");
    expect(blocks).toHaveLength(2);
    expect(blocks.find((b: any) => b.dayOfWeek === 4)).toBeDefined();
  });

  it("步驟 3：確認本週排班（應該更新所有記錄的 confirmedAt）", async () => {
    const dbInstance = await db.getDb();
    if (!dbInstance) throw new Error("Database not available");
    
    const { availability } = await import("../drizzle/schema");
    const { and, eq, gte, lt } = await import("drizzle-orm");
    
    const dayStart = new Date(weekStart);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 7);
    
    // 執行確認操作
    await dbInstance.update(availability)
      .set({ confirmedAt: new Date() })
      .where(
        and(
          eq(availability.workerId, workerId),
          gte(availability.weekStartDate, dayStart),
          lt(availability.weekStartDate, dayEnd)
        )
      );
    
    // 驗證所有記錄都已確認
    const records = await dbInstance.select().from(availability).where(
      and(
        eq(availability.workerId, workerId),
        gte(availability.weekStartDate, dayStart),
        lt(availability.weekStartDate, dayEnd)
      )
    );
    
    expect(records.length).toBeGreaterThan(0);
    records.forEach((record) => {
      expect(record.confirmedAt).not.toBeNull();
    });
  });

  it("步驟 4：檢查需求單的員工可用性（慕伊娜應該可以被指派）", async () => {
    const { checkWorkerAvailability } = await import("./businessLogic");
    
    const result = await checkWorkerAvailability(
      workerId,
      demandDate,
      demandStartTime,
      demandEndTime
    );
    
    console.log("員工可用性檢查結果：", result);
    
    expect(result.available).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("步驟 5：驗證資料庫中的排班記錄", async () => {
    const dbInstance = await db.getDb();
    if (!dbInstance) throw new Error("Database not available");
    
    const { availability } = await import("../drizzle/schema");
    const { and, eq, gte, lt } = await import("drizzle-orm");
    
    const dayStart = new Date(weekStart);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 7);
    
    const records = await dbInstance.select().from(availability).where(
      and(
        eq(availability.workerId, workerId),
        gte(availability.weekStartDate, dayStart),
        lt(availability.weekStartDate, dayEnd)
      )
    );
    
    console.log(`資料庫中共有 ${records.length} 筆排班記錄`);
    records.forEach((record, index) => {
      console.log(`記錄 ${index + 1}:`, {
        id: record.id,
        weekStartDate: record.weekStartDate,
        confirmedAt: record.confirmedAt,
        timeBlocks: record.timeBlocks,
      });
    });
    
    expect(records.length).toBeGreaterThan(0);
  });
});
