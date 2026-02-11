import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import * as logic from "./businessLogic";

describe("已取消需求單的人力釋放", () => {
  let testClientId: number;
  let testWorkerId: number;
  let testDemandId1: number; // 第一個需求單（會被取消）
  let testDemandId2: number; // 第二個需求單（用來測試員工是否可被指派）

  beforeAll(async () => {
    // 建立測試客戶
    const client = await db.createClient({
      name: "人力釋放測試客戶",
      contactPerson: "測試聯絡人",
      phone: "0912345678",
    });
    testClientId = client.id;

    // 建立測試員工
    const worker = await db.createWorker({
      name: "人力釋放測試員工",
      phone: "0912345678",
      status: "active",
      hasWorkPermit: 1,
      hasHealthCheck: 1,
    });
    testWorkerId = worker.id;

    // 建立第一個需求單（2026/02/27 09:50-14:02）
    const demand1 = await db.createDemand({
      clientId: testClientId,
      date: new Date("2026-02-27T00:00:00Z"),
      startTime: "09:50",
      endTime: "14:02",
      requiredWorkers: 1,
      hourlyRate: 200,
      status: "draft",
    });
    testDemandId1 = demand1;

    // 建立第二個需求單（同一天，2026/02/27 10:00-12:00）
    const demand2 = await db.createDemand({
      clientId: testClientId,
      date: new Date("2026-02-27T00:00:00Z"),
      startTime: "10:00",
      endTime: "12:00",
      requiredWorkers: 1,
      hourlyRate: 200,
      status: "draft",
    });
    testDemandId2 = demand2;

    // 指派員工到第一個需求單
    const demand1Info = await db.getDemandById(testDemandId1);
    const scheduledStart1 = new Date(`${demand1Info!.date.toISOString().split('T')[0]}T${demand1Info!.startTime}:00Z`);
    const scheduledEnd1 = new Date(`${demand1Info!.date.toISOString().split('T')[0]}T${demand1Info!.endTime}:00Z`);
    
    await db.createAssignment({
      demandId: testDemandId1,
      workerId: testWorkerId,
      status: "assigned",
      scheduledStart: scheduledStart1,
      scheduledEnd: scheduledEnd1,
      scheduledHours: 252, // 4小時12分 = 252分鐘
    });
  });

  afterAll(async () => {
    // 清理測試資料
    if (testDemandId1) {
      const assignments1 = await db.getAssignmentsByDemand(testDemandId1);
      for (const assignment of assignments1) {
        await db.deleteAssignment(assignment.id);
      }
      await db.deleteDemand(testDemandId1);
    }

    if (testDemandId2) {
      const assignments2 = await db.getAssignmentsByDemand(testDemandId2);
      for (const assignment of assignments2) {
        await db.deleteAssignment(assignment.id);
      }
      await db.deleteDemand(testDemandId2);
    }

    if (testWorkerId) {
      await db.deleteWorker(testWorkerId);
    }

    if (testClientId) {
      await db.deleteClient(testClientId);
    }
  });

  it("員工被指派到第一個需求單後，第二個需求單應該顯示「已指派到」原因", async () => {
    // 檢查第二個需求單的人力可行性
    const demand2 = await db.getDemandById(testDemandId2);
    const feasibility = await logic.calculateDemandFeasibility(
      testDemandId2,
      demand2!.date,
      demand2!.startTime,
      demand2!.endTime,
      demand2!.requiredWorkers
    );

    // 員工應該在不可指派列表中，並且有「已指派到」的原因
    const worker = feasibility.unavailableWorkers.find(w => w.id === testWorkerId);
    expect(worker).toBeDefined();
    
    const hasAssignmentReason = worker?.reasons.some(r => r.includes("已指派到"));
    expect(hasAssignmentReason).toBe(true);
  });

  it("第一個需求單被取消後，第二個需求單不應該再顯示「已指派到」原因", async () => {
    // 取消第一個需求單
    await db.updateDemand(testDemandId1, { status: "cancelled" });

    // 檢查第二個需求單的人力可行性
    const demand2 = await db.getDemandById(testDemandId2);
    const feasibility = await logic.calculateDemandFeasibility(
      testDemandId2,
      demand2!.date,
      demand2!.startTime,
      demand2!.endTime,
      demand2!.requiredWorkers
    );

    // 員工可能在不可指派列表中（因為其他原因，例如沒有設定排班時間）
    // 但不應該因為「已指派到」而被排除
    const worker = feasibility.unavailableWorkers.find(w => w.id === testWorkerId);
    
    if (worker) {
      const hasAssignmentReason = worker.reasons.some(r => r.includes("已指派到"));
      expect(hasAssignmentReason).toBe(false);
    }
    
    // 這個測試的重點是：取消需求單後，不應該再有「已指派到」的原因
  });
});
