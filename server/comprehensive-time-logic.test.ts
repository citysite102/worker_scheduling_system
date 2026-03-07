import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import * as logic from "./businessLogic";
import { cleanupTestData, TestDataIds } from "./test-utils";

/**
 * 時間邏輯全面測試
 * 涵蓋工時計算、休息時間、排班衝突檢測、可用性檢查、時區處理等
 */

describe("時間邏輯全面測試", () => {
  const testDataIds: TestDataIds = {
    assignments: [],
    demands: [],
    availability: [],
    workers: [],
    clients: [],
  };

  let testWorkerId1: number;
  let testWorkerId2: number;


  beforeAll(async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    // 建立測試客戶
    const client = await db.createClient({
      name: "時間邏輯測試客戶",
      contactName: "測試聯絡人",
      contactPhone: "0912345678",
    });
    testDataIds.clients!.push(client.id);

    // 建立測試員工
    const worker1 = await db.createWorker({
      name: "時間測試員工1",
      phone: "0987654321",
      email: "time-test1@example.com",
      school: "測試學校",
      status: "active",
      workPermitExpiryDate: new Date("2026-12-31"),
      healthCheckExpiryDate: new Date("2026-12-31"),
    });
    testWorkerId1 = worker1.id;

    const worker2 = await db.createWorker({
      name: "時間測試員工2",
      phone: "0987654322",
      email: "time-test2@example.com",
      school: "測試學校",
      status: "active",
      workPermitExpiryDate: new Date("2026-12-31"),
      healthCheckExpiryDate: new Date("2026-12-31"),
    });
    testWorkerId2 = worker2.id;

    // 建立測試需求單
    const testDate = new Date("2026-02-16T00:00:00.000Z"); // 2026-02-16 (週一)
    const demand = await db.createDemand({
      clientId: testDataIds.clients![0],
      date: testDate,
      startTime: "09:00",
      endTime: "17:00",
      requiredWorkers: 2,
      breakHours: 60, // 1小時休息時間（以分鐘儲存）
      status: "draft",
    });
    testDataIds.demands!.push(demand.id);
  });

  afterAll(async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    // 清理測試資料（按照外鍵依賴順序）
    // 1. 先刪除 assignments
    const assignments = await db.getAssignmentsByDemand(testDataIds.demands![0]);
    for (const assignment of assignments) {
      await db.deleteAssignment(assignment.id);
    }
    
    // 2. 刪除 demand
    await db.deleteDemand(testDataIds.demands![0]);
    
    // 3. 刪除 availability
    const weekStart = logic.getWeekStart(new Date("2026-02-16T00:00:00.000Z"));
    const avail1 = await db.getAvailabilityByWorkerAndWeek(testWorkerId1, weekStart);
    const avail2 = await db.getAvailabilityByWorkerAndWeek(testWorkerId2, weekStart);
    if (avail1 || avail2) {
      const { getDb } = await import("./db.ts");
      const { availability } = await import("../drizzle/schema.ts");
      const { eq } = await import("drizzle-orm");
      const dbConn = await getDb();
      if (dbConn) {
        if (avail1) await dbConn.delete(availability).where(eq(availability.id, avail1.id));
        if (avail2) await dbConn.delete(availability).where(eq(availability.id, avail2.id));
      }
    }
    
    // 4. 刪除 workers
    await db.deleteWorker(testWorkerId1);
    await db.deleteWorker(testWorkerId2);
    
    // 5. 刪除 client
    await db.deleteClient(testDataIds.clients![0]);
  });

  describe("1. 工時計算測試", () => {
    it("應正確計算正常工時（09:00-17:00 = 480分鐘）", () => {
      const start = new Date("2026-02-16T09:00:00.000Z");
      const end = new Date("2026-02-16T17:00:00.000Z");
      const minutes = logic.calculateMinutesBetween(start, end);
      expect(minutes).toBe(480); // 8小時 = 480分鐘
    });

    it("應正確計算跨日工時（23:00-01:00 = 120分鐘）", () => {
      const start = new Date("2026-02-16T23:00:00.000Z");
      const end = new Date("2026-02-17T01:00:00.000Z");
      const minutes = logic.calculateMinutesBetween(start, end);
      expect(minutes).toBe(120); // 2小時 = 120分鐘
    });

    it("應正確計算零點前後工時（23:30-00:30 = 60分鐘）", () => {
      const start = new Date("2026-02-16T23:30:00.000Z");
      const end = new Date("2026-02-17T00:30:00.000Z");
      const minutes = logic.calculateMinutesBetween(start, end);
      expect(minutes).toBe(60); // 1小時 = 60分鐘
    });

    it("應返回負數當結束時間早於開始時間", () => {
      const start = new Date("2026-02-16T17:00:00.000Z");
      const end = new Date("2026-02-16T09:00:00.000Z");
      const minutes = logic.calculateMinutesBetween(start, end);
      expect(minutes).toBe(-480); // -8小時 = -480分鐘
    });

    it("應正確計算相同時間（00:00-00:00 = 0分鐘）", () => {
      const start = new Date("2026-02-16T00:00:00.000Z");
      const end = new Date("2026-02-16T00:00:00.000Z");
      const minutes = logic.calculateMinutesBetween(start, end);
      expect(minutes).toBe(0);
    });
  });

  describe("2. 時間重疊判斷測試", () => {
    it("應正確判斷完全重疊（09:00-17:00 vs 09:00-17:00）", () => {
      const start1 = new Date("2026-02-16T09:00:00.000Z");
      const end1 = new Date("2026-02-16T17:00:00.000Z");
      const start2 = new Date("2026-02-16T09:00:00.000Z");
      const end2 = new Date("2026-02-16T17:00:00.000Z");
      expect(logic.isTimeOverlap(start1, end1, start2, end2)).toBe(true);
    });

    it("應正確判斷部分重疊（09:00-12:00 vs 11:00-14:00）", () => {
      const start1 = new Date("2026-02-16T09:00:00.000Z");
      const end1 = new Date("2026-02-16T12:00:00.000Z");
      const start2 = new Date("2026-02-16T11:00:00.000Z");
      const end2 = new Date("2026-02-16T14:00:00.000Z");
      expect(logic.isTimeOverlap(start1, end1, start2, end2)).toBe(true);
    });

    it("應正確判斷不重疊（09:00-12:00 vs 13:00-17:00）", () => {
      const start1 = new Date("2026-02-16T09:00:00.000Z");
      const end1 = new Date("2026-02-16T12:00:00.000Z");
      const start2 = new Date("2026-02-16T13:00:00.000Z");
      const end2 = new Date("2026-02-16T17:00:00.000Z");
      expect(logic.isTimeOverlap(start1, end1, start2, end2)).toBe(false);
    });

    it("應正確判斷邊界接觸（09:00-12:00 vs 12:00-17:00）", () => {
      const start1 = new Date("2026-02-16T09:00:00.000Z");
      const end1 = new Date("2026-02-16T12:00:00.000Z");
      const start2 = new Date("2026-02-16T12:00:00.000Z");
      const end2 = new Date("2026-02-16T17:00:00.000Z");
      expect(logic.isTimeOverlap(start1, end1, start2, end2)).toBe(false); // 邊界接觸不算重疊
    });

    it("應正確判斷包含關係（09:00-17:00 vs 11:00-14:00）", () => {
      const start1 = new Date("2026-02-16T09:00:00.000Z");
      const end1 = new Date("2026-02-16T17:00:00.000Z");
      const start2 = new Date("2026-02-16T11:00:00.000Z");
      const end2 = new Date("2026-02-16T14:00:00.000Z");
      expect(logic.isTimeOverlap(start1, end1, start2, end2)).toBe(true);
    });

    it("應正確判斷跨日重疊（23:00-01:00 vs 00:00-02:00）", () => {
      const start1 = new Date("2026-02-16T23:00:00.000Z");
      const end1 = new Date("2026-02-17T01:00:00.000Z");
      const start2 = new Date("2026-02-17T00:00:00.000Z");
      const end2 = new Date("2026-02-17T02:00:00.000Z");
      expect(logic.isTimeOverlap(start1, end1, start2, end2)).toBe(true);
    });
  });

  describe("3. 排班衝突檢測測試", () => {
    let assignment1Id: number;
    let assignment2Id: number;

    beforeAll(async () => {
      const _dbConn = await db.getDb();
      if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
      // 建立第一個排班記錄（09:00-12:00）
      const scheduledStart1 = new Date("2026-02-16T09:00:00.000Z");
      const scheduledEnd1 = new Date("2026-02-16T12:00:00.000Z");
      const assignment1 = await db.createAssignment({
        demandId: testDataIds.demands![0],
        workerId: testWorkerId1,
        scheduledStart: scheduledStart1,
        scheduledEnd: scheduledEnd1,
        scheduledHours: logic.calculateMinutesBetween(scheduledStart1, scheduledEnd1),
        status: "assigned",
      });
      assignment1Id = assignment1.id;

      // 建立第二個排班記錄（14:00-17:00）
      const scheduledStart2 = new Date("2026-02-16T14:00:00.000Z");
      const scheduledEnd2 = new Date("2026-02-16T17:00:00.000Z");
      const assignment2 = await db.createAssignment({
        demandId: testDataIds.demands![0],
        workerId: testWorkerId1,
        scheduledStart: scheduledStart2,
        scheduledEnd: scheduledEnd2,
        scheduledHours: logic.calculateMinutesBetween(scheduledStart2, scheduledEnd2),
        status: "assigned",
      });
      assignment2Id = assignment2.id;
    });

    afterAll(async () => {
      const _dbConn = await db.getDb();
      if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    await cleanupTestData(testDataIds);
  });

    it("應檢測到與第一個排班記錄的衝突（10:00-13:00 vs 09:00-12:00）", async () => {
      const _dbConn = await db.getDb();
      if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
      const scheduledStart = new Date("2026-02-16T10:00:00.000Z");
      const scheduledEnd = new Date("2026-02-16T13:00:00.000Z");
      const conflicts = await logic.checkWorkerConflicts(
        testWorkerId1,
        scheduledStart,
        scheduledEnd
      );
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].id).toBe(assignment1Id);
      expect(conflicts[0].workerId).toBe(testWorkerId1);
    });

    it("應檢測到與第二個排班記錄的衝突（13:00-15:00 vs 14:00-17:00）", async () => {
      const _dbConn = await db.getDb();
      if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
      const scheduledStart = new Date("2026-02-16T13:00:00.000Z");
      const scheduledEnd = new Date("2026-02-16T15:00:00.000Z");
      const conflicts = await logic.checkWorkerConflicts(
        testWorkerId1,
        scheduledStart,
        scheduledEnd
      );
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].id).toBe(assignment2Id);
      expect(conflicts[0].workerId).toBe(testWorkerId1);
    });

    it("應不檢測到衝突（12:00-14:00 不與任何排班重疊）", async () => {
      const _dbConn = await db.getDb();
      if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
      const scheduledStart = new Date("2026-02-16T12:00:00.000Z");
      const scheduledEnd = new Date("2026-02-16T14:00:00.000Z");
      const conflicts = await logic.checkWorkerConflicts(
        testWorkerId1,
        scheduledStart,
        scheduledEnd
      );
      expect(conflicts.length).toBe(0);
    });

    it("應正確排除指定的排班記錄（使用 excludeAssignmentId）", async () => {
      const _dbConn = await db.getDb();
      if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
      const scheduledStart = new Date("2026-02-16T10:00:00.000Z");
      const scheduledEnd = new Date("2026-02-16T13:00:00.000Z");
      const conflicts = await logic.checkWorkerConflicts(
        testWorkerId1,
        scheduledStart,
        scheduledEnd,
        assignment1Id // 排除第一個排班記錄
      );
      expect(conflicts.length).toBe(0);
    });
  });

  describe("4. 可用性檢查測試", () => {
    beforeAll(async () => {
      const _dbConn = await db.getDb();
      if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
      // 設定員工1的排班時間（週一 09:00-17:00）
      const weekStart = logic.getWeekStart(new Date("2026-02-16T00:00:00.000Z"));
      await db.upsertAvailability({
        workerId: testWorkerId1,
        weekStartDate: weekStart,
        weekEndDate: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
        timeBlocks: JSON.stringify([
          {
            dayOfWeek: 1, // 週一
            timeSlots: [{ startTime: "09:00", endTime: "17:00" }],
          },
        ]),
        confirmedAt: new Date(),
      });
    });

    it("應判斷員工在可排班時段內（週一 09:00-17:00）", async () => {
      const _dbConn = await db.getDb();
      if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
      const demandDate = new Date("2026-02-16T00:00:00.000Z"); // 週一
      const result = await logic.checkWorkerAvailability(
        testWorkerId1,
        demandDate,
        "09:00",
        "17:00"
      );
      expect(result.available).toBe(true);
    });

    it("應判斷員工在可排班時段內（週一 10:00-16:00，包含在 09:00-17:00 內）", async () => {
      const _dbConn = await db.getDb();
      if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
      const demandDate = new Date("2026-02-16T00:00:00.000Z"); // 週一
      const result = await logic.checkWorkerAvailability(
        testWorkerId1,
        demandDate,
        "10:00",
        "16:00"
      );
      expect(result.available).toBe(true);
    });

    it("應判斷員工不在可排班時段內（週一 08:00-18:00，超出 09:00-17:00）", async () => {
      const _dbConn = await db.getDb();
      if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
      const demandDate = new Date("2026-02-16T00:00:00.000Z"); // 週一
      const result = await logic.checkWorkerAvailability(
        testWorkerId1,
        demandDate,
        "08:00",
        "18:00"
      );
      expect(result.available).toBe(false);
      expect(result.reason).toContain("不在可排班時段");
    });

    it("應判斷員工在週二無可排班時段", async () => {
      const _dbConn = await db.getDb();
      if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
      const demandDate = new Date("2026-02-17T00:00:00.000Z"); // 週二
      const result = await logic.checkWorkerAvailability(
        testWorkerId1,
        demandDate,
        "09:00",
        "17:00"
      );
      expect(result.available).toBe(false);
      expect(result.reason).toContain("該日無可排班時段");
    });

    it("應判斷員工2排班時間設置未設定", async () => {
      const _dbConn = await db.getDb();
      if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
      const demandDate = new Date("2026-02-16T00:00:00.000Z"); // 週一
      const result = await logic.checkWorkerAvailability(
        testWorkerId2,
        demandDate,
        "09:00",
        "17:00"
      );
      expect(result.available).toBe(false);
      expect(result.reason).toContain("本週排班時間設置未設定");
    });
  });

  describe("5. 時區處理測試", () => {
    it("getWeekStart 應返回週一 UTC 00:00:00", () => {
      const date = new Date("2026-02-16T12:34:56.789Z"); // 週一中午
      const weekStart = logic.getWeekStart(date);
      expect(weekStart.getUTCFullYear()).toBe(2026);
      expect(weekStart.getUTCMonth()).toBe(1); // 2月（0-based）
      expect(weekStart.getUTCDate()).toBe(16);
      expect(weekStart.getUTCHours()).toBe(0);
      expect(weekStart.getUTCMinutes()).toBe(0);
      expect(weekStart.getUTCSeconds()).toBe(0);
      expect(weekStart.getUTCMilliseconds()).toBe(0);
    });

    it("getWeekStart 應正確處理週日（返回前一週的週一）", () => {
      const date = new Date("2026-02-15T12:00:00.000Z"); // 週日
      const weekStart = logic.getWeekStart(date);
      expect(weekStart.getUTCDate()).toBe(9); // 2026-02-09 (週一)
    });

    it("combineDateAndTime 應正確組合日期與時間", () => {
      const date = new Date("2026-02-16T00:00:00.000Z");
      const result = logic.combineDateAndTime(date, "09:30");
      // 使用 getUTCHours/getUTCMinutes 驗證，因為 combineDateAndTime 使用 setUTCHours
      expect(result.getUTCHours()).toBe(9);
      expect(result.getUTCMinutes()).toBe(30);
    });
  });

  describe("6. 邊界條件測試", () => {
    it("應正確處理午夜時間（00:00）", () => {
      const start = new Date("2026-02-16T00:00:00.000Z");
      const end = new Date("2026-02-16T08:00:00.000Z");
      const minutes = logic.calculateMinutesBetween(start, end);
      expect(minutes).toBe(480); // 8小時
    });

    it("應正確處理 23:59 時間", () => {
      const start = new Date("2026-02-16T23:59:00.000Z");
      const end = new Date("2026-02-17T00:01:00.000Z");
      const minutes = logic.calculateMinutesBetween(start, end);
      expect(minutes).toBe(2); // 2分鐘
    });

    it("應正確處理跨月份的排班", () => {
      const start = new Date("2026-02-28T20:00:00.000Z");
      const end = new Date("2026-03-01T04:00:00.000Z");
      const minutes = logic.calculateMinutesBetween(start, end);
      expect(minutes).toBe(480); // 8小時
    });

    it("應正確處理閏年的 2 月 29 日", () => {
      const start = new Date("2024-02-29T09:00:00.000Z");
      const end = new Date("2024-02-29T17:00:00.000Z");
      const minutes = logic.calculateMinutesBetween(start, end);
      expect(minutes).toBe(480); // 8小時
    });
  });
});
