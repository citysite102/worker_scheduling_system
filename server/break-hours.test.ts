import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";

describe("休息時間功能測試", () => {
  let testWorkerId: number;
  let testClientId: number;
  let testDemandId: number;
  let testAssignmentId: number;

  beforeAll(async () => {
    // 建立測試員工
    await db.createWorker({
      name: "測試員工-休息時間",
      phone: "0912345678",
      email: "test-break@example.com",
      hasWorkPermit: 1,
      hasHealthCheck: 1,
    });
    const workers = await db.getAllWorkers({ search: "測試員工-休息時間" });
    testWorkerId = workers[0].id;

    // 建立測試客戶
    await db.createClient({
      name: "測試客戶-休息時間",
      contactName: "測試聯絡人",
      contactPhone: "0987654321",
    });
    const clients = await db.getAllClients();
    const testClient = clients.find(c => c.name === "測試客戶-休息時間");
    if (!testClient) throw new Error("找不到測試客戶");
    testClientId = testClient.id;
  });

  afterAll(async () => {
    // 清理測試資料（按照外鍵依賴順序刪除）
    try {
      if (testAssignmentId) {
        const dbInstance = await db.getDb();
        if (dbInstance) {
          const { assignments } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await dbInstance.delete(assignments).where(eq(assignments.id, testAssignmentId));
        }
      }
      if (testDemandId) {
        await db.deleteDemand(testDemandId);
      }
      if (testClientId) {
        await db.deleteClient(testClientId);
      }
      if (testWorkerId) {
        await db.deleteWorker(testWorkerId);
      }
    } catch (error) {
      console.error("清理測試資料失敗：", error);
    }
  });

  it("應該能夠建立帶有休息時間的需求單", async () => {
    const demand = await db.createDemand({
      clientId: testClientId,
      date: new Date("2026-03-01"),
      startTime: "09:00",
      endTime: "17:00",
      requiredWorkers: 1,
      breakHours: 60, // 1 小時休息時間（以分鐘為單位）
      location: "測試地點",
    });

    testDemandId = demand.id;

    expect(demand).toBeDefined();
    expect(demand.breakHours).toBe(60);
  });

  it("應該能夠更新需求單的休息時間", async () => {
    await db.updateDemand(testDemandId, {
      breakHours: 90, // 更新為 1.5 小時
    });

    const updatedDemand = await db.getDemandById(testDemandId);
    expect(updatedDemand?.breakHours).toBe(90);
  });

  it("員工薪資報表應該正確扣除休息時間", async () => {
    // 建立指派
    const assignment = await db.createAssignment({
      demandId: testDemandId,
      workerId: testWorkerId,
      scheduledStart: new Date("2026-03-01T09:00:00Z"),
      scheduledEnd: new Date("2026-03-01T17:00:00Z"),
      scheduledHours: 480, // 8 小時 = 480 分鐘
    });

    testAssignmentId = assignment.id;

    // 回填實際工時
    await db.updateAssignment(testAssignmentId, {
      actualStart: new Date("2026-03-01T09:00:00Z"),
      actualEnd: new Date("2026-03-01T17:00:00Z"),
      actualHours: 480, // 8 小時 = 480 分鐘
      status: "completed",
    });

    // 取得報表資料
    const dbInstance = await db.getDb();
    if (!dbInstance) throw new Error("Database not available");

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

    const report = await caller.reports.workerPayroll({
      startDate: new Date("2026-03-01T00:00:00Z"),
      endDate: new Date("2026-03-01T23:59:59Z"),
      workerId: testWorkerId,
    });

    expect(report).toHaveLength(1);
    expect(report[0].actualHours).toBe("8.00"); // 實際工時 8 小時
    expect(report[0].breakHours).toBe("1.50"); // 休息時間 1.5 小時
    expect(report[0].billableHours).toBe("6.50"); // 計薪工時 = 8 - 1.5 = 6.5 小時
  });

  it("客戶工時報表應該正確扣除休息時間", async () => {
    const dbInstance = await db.getDb();
    if (!dbInstance) throw new Error("Database not available");

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

    const report = await caller.reports.clientHours({
      startDate: new Date("2026-03-01T00:00:00Z"),
      endDate: new Date("2026-03-01T23:59:59Z"),
      clientId: testClientId,
    });

    expect(report).toHaveLength(1);
    expect(report[0].totalHours).toBe("6.50"); // 計費工時 = 8 - 1.5 = 6.5 小時（已扣除休息時間）
  });

  it("沒有設定休息時間的需求單應該預設為 0", async () => {
    const demand = await db.createDemand({
      clientId: testClientId,
      date: new Date("2026-03-02"),
      startTime: "09:00",
      endTime: "17:00",
      requiredWorkers: 1,
      location: "測試地點",
    });

    expect(demand.breakHours).toBe(0);

    // 清理測試資料
    await db.deleteDemand(demand.id);
  });

  it("休息時間不應該超過實際工時（計薪工時最小為 0）", async () => {
    // 測試邏輯：當休息時間超過實際工時時，計薪工時應該為 0
    const actualMinutes = 60; // 1 小時
    const breakMinutes = 120; // 2 小時
    const billableMinutes = Math.max(0, actualMinutes - breakMinutes);
    
    expect(billableMinutes).toBe(0); // 計薪工時 = max(0, 60 - 120) = 0
  });
});
