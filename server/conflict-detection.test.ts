import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import * as db from "./db";
import * as logic from "./businessLogic";
import { cleanupTestData, TestDataIds } from "./test-utils";

describe("排班衝突檢測測試", () => {
  // 增加測試超時時間，因為 calculateDemandFeasibility 可能需要較長時間
  vi.setConfig({ testTimeout: 15000 });
  const testDataIds: TestDataIds = {
    assignments: [],
    demands: [],
    availability: [],
    workers: [],
    clients: [],
  };

  let testDemand1Id: number;
  let testDemand2Id: number;
  let testAssignment1Id: number;






  beforeAll(async () => {
    // 建立測試客戶
    const client = await db.createClient({
      name: "衝突檢測測試客戶",
      contactPerson: "測試聯絡人",
      phone: "0912345678",
    });
    testDataIds.clients!.push(client.id);

    // 建立測試員工
    const worker = await db.createWorker({
      name: "衝突檢測測試員工",
      phone: "0912345678",
      status: "active",
      hasWorkPermit: 1,
      hasHealthCheck: 1,
    });
    testDataIds.workers!.push(worker.id);

    // 建立第一個需求單（2026-03-15 11:00-13:00）
    const demand1 = await db.createDemand({
      clientId: testDataIds.clients![0],
      date: new Date("2026-03-15T00:00:00Z"),
      startTime: "11:00",
      endTime: "13:00",
      requiredWorkers: 1,
      status: "confirmed",
    });
    testDemand1Id = demand1.id;

    // 指派員工到第一個需求單
    const scheduledStart1 = logic.combineDateAndTime(new Date("2026-03-15T00:00:00Z"), "11:00");
    const scheduledEnd1 = logic.combineDateAndTime(new Date("2026-03-15T00:00:00Z"), "13:00");
    const scheduledHours1 = logic.calculateMinutesBetween(scheduledStart1, scheduledEnd1);

    const assignment1 = await db.createAssignment({
      demandId: testDemand1Id,
      workerId: testDataIds.workers![0],
      scheduledStart: scheduledStart1,
      scheduledEnd: scheduledEnd1,
      scheduledHours: scheduledHours1,
      status: "assigned",
    });
    testAssignment1Id = assignment1.id;

    // 建立第二個需求單（2026-03-15 11:00-13:00，與第一個完全重疊）
    const demand2 = await db.createDemand({
      clientId: testDataIds.clients![0],
      date: new Date("2026-03-15T00:00:00Z"),
      startTime: "11:00",
      endTime: "13:00",
      requiredWorkers: 1,
      status: "confirmed",
    });
    testDemand2Id = demand2.id;
  });

  afterAll(async () => {
    // 清理測試資料
    try {
      if (testAssignment1Id) {
        await db.deleteAssignment(testAssignment1Id);
      }
      if (testDemand1Id) {
        await db.deleteDemand(testDemand1Id);
      }
      if (testDemand2Id) {
        await db.deleteDemand(testDemand2Id);
      }
      if (testDataIds.clients![0]) {
        await db.deleteClient(testDataIds.clients![0]);
      }
      if (testDataIds.workers![0]) {
        await db.deleteWorker(testDataIds.workers![0]);
      }
    } catch (e) {
      console.error("清理測試資料失敗：", e);
    }
  });

  it("checkWorkerConflicts 應該檢測到時段衝突", async () => {
    const scheduledStart2 = logic.combineDateAndTime(new Date("2026-03-15T00:00:00Z"), "11:00");
    const scheduledEnd2 = logic.combineDateAndTime(new Date("2026-03-15T00:00:00Z"), "13:00");

    const conflicts = await logic.checkWorkerConflicts(
      testDataIds.workers![0],
      scheduledStart2,
      scheduledEnd2
    );

    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].demandId).toBe(testDemand1Id);
  });

  it("calculateDemandFeasibility 應該將有衝突的員工標記為不可指派", async () => {
    const feasibility = await logic.calculateDemandFeasibility(
      testDemand2Id,
      new Date("2026-03-15T00:00:00Z"),
      "11:00",
      "13:00",
      1
    );

    console.log("=== Feasibility Result ===");
    console.log("Available workers:", feasibility.availableWorkers.length);
    console.log("Unavailable workers:", feasibility.unavailableWorkers.length);
    
    const testWorkerInUnavailable = feasibility.unavailableWorkers.find(
      uw => uw.worker.id === testDataIds.workers![0]
    );
    
    if (testWorkerInUnavailable) {
      console.log("Test worker reasons:", testWorkerInUnavailable.reasons);
    } else {
      console.log("Test worker NOT found in unavailable list!");
      const testWorkerInAvailable = feasibility.availableWorkers.find(
        w => w.id === testDataIds.workers![0]
      );
      if (testWorkerInAvailable) {
        console.log("Test worker found in AVAILABLE list - THIS IS THE BUG!");
      }
    }

    // 測試員工應該在不可指派列表中
    expect(testWorkerInUnavailable).toBeDefined();
    // 檢查 reasons 中是否有任何一個包含「排班衝突」的字串
    const hasConflictReason = testWorkerInUnavailable?.reasons.some(r => r.includes("排班衝突"));
    expect(hasConflictReason).toBe(true);
  });

  it("指派時應該拋出衝突錯誤", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

    const scheduledStart2 = logic.combineDateAndTime(new Date("2026-03-15T00:00:00Z"), "11:00");
    const scheduledEnd2 = logic.combineDateAndTime(new Date("2026-03-15T00:00:00Z"), "13:00");

    await expect(
      caller.assignments.assignWorkers({
        demandId: testDemand2Id,
        workerIds: [testDataIds.workers![0]],
        scheduledStart: scheduledStart2,
        scheduledEnd: scheduledEnd2,
      })
    ).rejects.toThrow();
  });
});
