import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import * as logic from "./businessLogic";

describe("2026/02/12 Bug 修復測試", () => {
  let testClientId: number;
  let testWorkerId: number;
  let testDemandId: number;
  let testAssignmentId: number;

  beforeAll(async () => {
    // 建立測試客戶
    const client = await db.createClient({
      name: "Bug修復測試客戶",
      contactPerson: "測試聯絡人",
      phone: "0912345678",
    });
    testClientId = client.id;

    // 建立測試員工
    const worker = await db.createWorker({
      name: "Bug修復測試員工",
      phone: "0912345678",
      status: "active",
      hasWorkPermit: 1,
      hasHealthCheck: 1,
    });
    testWorkerId = worker.id;

    // 建立測試需求單（2026/03/01 09:00-17:00，休息時間 1 小時）
    const demand = await db.createDemand({
      clientId: testClientId,
      date: new Date("2026-03-01T00:00:00Z"),
      startTime: "09:00",
      endTime: "17:00",
      requiredWorkers: 1,
      breakHours: 60, // 1 小時 = 60 分鐘
      status: "confirmed",
    });
    testDemandId = demand.id;

    // 指派員工
    const scheduledStart = new Date("2026-03-01T09:00:00Z");
    const scheduledEnd = new Date("2026-03-01T17:00:00Z");
    const scheduledHours = logic.calculateMinutesBetween(scheduledStart, scheduledEnd);

    const assignment = await db.createAssignment({
      demandId: testDemandId,
      workerId: testWorkerId,
      scheduledStart,
      scheduledEnd,
      scheduledHours,
      status: "assigned",
    });
    testAssignmentId = assignment.id;
  });

  afterAll(async () => {
    // 清理測試資料
    try {
      if (testAssignmentId) {
        await db.deleteAssignment(testAssignmentId);
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
    } catch (e) {
      console.error("清理測試資料失敗：", e);
    }
  });

  describe("Bug 2: 複製需求單時沒有複製休息時間", () => {
    let duplicatedDemandId: number;

    afterAll(async () => {
      // 清理複製的需求單
      if (duplicatedDemandId) {
        try {
          await db.deleteDemand(duplicatedDemandId);
        } catch (e) {
          console.error("清理複製的需求單失敗：", e);
        }
      }
    });

    it("複製需求單時應該複製休息時間", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      // 複製需求單
      const result = await caller.demands.duplicate({ id: testDemandId });
      expect(result.success).toBe(true);
      expect(result.newDemandId).toBeDefined();

      duplicatedDemandId = result.newDemandId!;

      // 檢查複製的需求單是否有休息時間
      const duplicatedDemand = await db.getDemandById(duplicatedDemandId);
      expect(duplicatedDemand).toBeDefined();
      expect(duplicatedDemand!.breakHours).toBe(60); // 應該複製原需求單的休息時間
    });
  });

  describe("Bug 3: 實際工時可以是負數且可以重複打卡", () => {
    it("結束時間早於開始時間時應該拋出錯誤", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      // 嘗試回填負數工時（結束時間早於開始時間）
      await expect(
        caller.assignments.fillActualTime({
          assignmentId: testAssignmentId,
          actualStartTime: "17:00",
          actualEndTime: "09:00", // 結束時間早於開始時間
        })
      ).rejects.toThrow("結束時間必須晚於開始時間");
    });

    it("重複回填實際工時時應該拋出錯誤", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      // 第一次回填實際工時
      await caller.assignments.fillActualTime({
        assignmentId: testAssignmentId,
        actualStartTime: "09:00",
        actualEndTime: "17:00",
      });

      // 嘗試第二次回填實際工時
      await expect(
        caller.assignments.fillActualTime({
          assignmentId: testAssignmentId,
          actualStartTime: "09:00",
          actualEndTime: "18:00",
        })
      ).rejects.toThrow("該排班記錄已經回填過實際工時，不可重複回填");
    });
  });
});
