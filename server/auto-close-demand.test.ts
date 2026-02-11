import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import * as logic from "./businessLogic";

describe("實際工時回填後自動結案功能", () => {
  let testClientId: number;
  let testWorkerId1: number;
  let testWorkerId2: number;
  let testDemandId: number;
  let testAssignmentId1: number;
  let testAssignmentId2: number;

  beforeAll(async () => {
    // 建立測試客戶
    const client = await db.createClient({
      name: "自動結案測試客戶",
      contactPerson: "測試聯絡人",
      phone: "0912345678",
    });
    testClientId = client.id;

    // 建立測試員工 1
    const worker1 = await db.createWorker({
      name: "自動結案測試員工 1",
      phone: "0912345678",
      status: "active",
      hasWorkPermit: 1,
      hasHealthCheck: 1,
    });
    testWorkerId1 = worker1.id;

    // 建立測試員工 2
    const worker2 = await db.createWorker({
      name: "自動結案測試員工 2",
      phone: "0912345679",
      status: "active",
      hasWorkPermit: 1,
      hasHealthCheck: 1,
    });
    testWorkerId2 = worker2.id;

    // 建立測試需求單（2026/02/28 09:00-17:00，需要 2 位員工）
    const demand = await db.createDemand({
      clientId: testClientId,
      date: new Date("2026-02-28T00:00:00Z"),
      startTime: "09:00",
      endTime: "17:00",
      requiredWorkers: 2,
      status: "confirmed",
    });
    testDemandId = demand.id;

    // 指派員工 1
    const scheduledStart = new Date("2026-02-28T09:00:00Z");
    const scheduledEnd = new Date("2026-02-28T17:00:00Z");
    const scheduledHours = logic.calculateMinutesBetween(scheduledStart, scheduledEnd);

    const assignment1 = await db.createAssignment({
      demandId: testDemandId,
      workerId: testWorkerId1,
      scheduledStart,
      scheduledEnd,
      scheduledHours,
      status: "assigned",
    });
    testAssignmentId1 = assignment1.id;

    // 指派員工 2
    const assignment2 = await db.createAssignment({
      demandId: testDemandId,
      workerId: testWorkerId2,
      scheduledStart,
      scheduledEnd,
      scheduledHours,
      status: "assigned",
    });
    testAssignmentId2 = assignment2.id;
  });

  afterAll(async () => {
    // 清理測試資料（按照外鍵依賴順序）
    try {
      if (testAssignmentId1) {
        await db.deleteAssignment(testAssignmentId1);
      }
      if (testAssignmentId2) {
        await db.deleteAssignment(testAssignmentId2);
      }
      if (testDemandId) {
        await db.deleteDemand(testDemandId);
      }
      if (testClientId) {
        await db.deleteClient(testClientId);
      }
      if (testWorkerId1) {
        await db.deleteWorker(testWorkerId1);
      }
      if (testWorkerId2) {
        await db.deleteWorker(testWorkerId2);
      }
    } catch (e) {
      console.error("清理測試資料失敗：", e);
    }
  });

  it("只回填一位員工的實際工時時，需求單不應該自動結案", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });
    
    // 回填員工 1 的實際工時
    const result = await caller.assignments.fillActualTime({
      assignmentId: testAssignmentId1,
      actualStartTime: "09:00",
      actualEndTime: "17:00",
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe("completed");
    expect(result.demandClosed).toBe(false);

    // 檢查需求單狀態
    const demand = await db.getDemandById(testDemandId);
    expect(demand?.status).toBe("confirmed");
  });

  it("回填所有員工的實際工時後，需求單應該自動結案", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });
    
    // 回填員工 2 的實際工時
    const result = await caller.assignments.fillActualTime({
      assignmentId: testAssignmentId2,
      actualStartTime: "09:00",
      actualEndTime: "17:00",
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe("completed");
    expect(result.demandClosed).toBe(true);

    // 檢查需求單狀態
    const demand = await db.getDemandById(testDemandId);
    expect(demand?.status).toBe("closed");
  });

  it("已結案的需求單應該顯示為「已結案」狀態", async () => {
    const demand = await db.getDemandById(testDemandId);
    expect(demand?.status).toBe("closed");
  });
});
