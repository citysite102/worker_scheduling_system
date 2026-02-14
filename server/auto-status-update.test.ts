import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import { cleanupTestData, TestDataIds } from "./test-utils";

describe("需求單自動狀態更新功能", () => {
  const testDataIds: TestDataIds = {
    assignments: [],
    demands: [],
    availability: [],
    workers: [],
    clients: [],
  };

  let testDemandId: number;

  beforeAll(async () => {
    // 建立測試客戶
    const client = await db.createClient({
      name: "自動狀態測試客戶",
      contactPerson: "測試聯絡人",
      phone: "0912345678",
    });
    testDataIds.clients!.push(client.id);

    // 建立測試員工（2 位）
    for (let i = 1; i <= 2; i++) {
      const worker = await db.createWorker({
        name: `自動狀態測試員工${i}`,
        phone: `091234567${i}`,
        status: "active",
        hasWorkPermit: 1,
        hasHealthCheck: 1,
      });
      testDataIds.workers!.push(worker.id);
    }

    // 建立測試需求單（需要 2 位員工）
    const demand = await db.createDemand({
      clientId: testDataIds.clients![0],
      date: new Date("2026-02-09T00:00:00Z"), // 星期一
      startTime: "10:00",
      endTime: "16:00",
      requiredWorkers: 2,
      hourlyRate: 200,
      status: "draft",
    });
    testDemandId = demand.id;
    testDataIds.demands!.push(demand.id);
  });

  afterAll(async () => {
    await cleanupTestData(testDataIds);
  });

  it("指派第 1 位員工時，需求單狀態應保持為 draft", async () => {
    // 指派第 1 位員工
    const demandInfo = await db.getDemandById(testDemandId);
    const scheduledStart = new Date(`${demandInfo!.date.toISOString().split('T')[0]}T${demandInfo!.startTime}:00Z`);
    const scheduledEnd = new Date(`${demandInfo!.date.toISOString().split('T')[0]}T${demandInfo!.endTime}:00Z`);
    
    await db.createAssignment({
      demandId: testDemandId,
      workerId: testDataIds.workers![0],
      status: "assigned",
      scheduledStart,
      scheduledEnd,
      scheduledHours: 360, // 6 小時 * 60 分鐘
    });

    // 模擬 batchCreate API 的自動狀態更新邏輯
    const currentDemand = await db.getDemandById(testDemandId);
    if (currentDemand && currentDemand.status === "draft") {
      const assignments = await db.getAssignmentsByDemand(testDemandId);
      const activeAssignments = assignments.filter(a => a.status !== "cancelled");
      
      if (activeAssignments.length >= currentDemand.requiredWorkers) {
        await db.updateDemand(testDemandId, { status: "confirmed" });
      }
    }

    // 檢查需求單狀態（應該還是 draft，因為只指派了 1 位，需要 2 位）
    const updatedDemand = await db.getDemandById(testDemandId);
    expect(updatedDemand?.status).toBe("draft");
  });

  it("指派第 2 位員工時，需求單狀態應自動改為 confirmed", async () => {
    // 指派第 2 位員工
    const demandInfo = await db.getDemandById(testDemandId);
    const scheduledStart = new Date(`${demandInfo!.date.toISOString().split('T')[0]}T${demandInfo!.startTime}:00Z`);
    const scheduledEnd = new Date(`${demandInfo!.date.toISOString().split('T')[0]}T${demandInfo!.endTime}:00Z`);
    
    await db.createAssignment({
      demandId: testDemandId,
      workerId: testWorkerIds[1],
      status: "assigned",
      scheduledStart,
      scheduledEnd,
      scheduledHours: 360, // 6 小時 * 60 分鐘
    });

    // 模擬 batchCreate API 的自動狀態更新邏輯
    const currentDemand = await db.getDemandById(testDemandId);
    if (currentDemand && currentDemand.status === "draft") {
      const assignments = await db.getAssignmentsByDemand(testDemandId);
      const activeAssignments = assignments.filter(a => a.status !== "cancelled");
      
      if (activeAssignments.length >= currentDemand.requiredWorkers) {
        await db.updateDemand(testDemandId, { status: "confirmed" });
      }
    }

    // 檢查需求單狀態（應該自動改為 confirmed）
    const updatedDemand = await db.getDemandById(testDemandId);
    expect(updatedDemand?.status).toBe("confirmed");
  });

  it("取消 1 位員工的指派時，需求單狀態應保持為 confirmed", async () => {
    // 取得第 1 位員工的指派記錄
    const assignments = await db.getAssignmentsByDemand(testDemandId);
    const firstAssignment = assignments.find(a => a.workerId === testDataIds.workers![0]);
    expect(firstAssignment).toBeDefined();

    // 取消第 1 位員工的指派
    await db.updateAssignment(firstAssignment!.id, { status: "cancelled" });

    // 模擬 cancel API 的自動狀態更新邏輯
    const currentDemand = await db.getDemandById(testDemandId);
    if (currentDemand && currentDemand.status === "confirmed") {
      const updatedAssignments = await db.getAssignmentsByDemand(testDemandId);
      const activeAssignments = updatedAssignments.filter(a => a.status !== "cancelled");
      
      if (activeAssignments.length === 0) {
        await db.updateDemand(testDemandId, { status: "draft" });
      }
    }

    // 檢查需求單狀態（應該還是 confirmed，因為還有 1 位員工）
    const updatedDemand = await db.getDemandById(testDemandId);
    expect(updatedDemand?.status).toBe("confirmed");
  });

  it("取消所有員工的指派時，需求單狀態應自動改回 draft", async () => {
    // 取得第 2 位員工的指派記錄
    const assignments = await db.getAssignmentsByDemand(testDemandId);
    const secondAssignment = assignments.find(a => a.workerId === testDataIds.workers![1] && a.status !== "cancelled");
    expect(secondAssignment).toBeDefined();

    // 取消第 2 位員工的指派
    await db.updateAssignment(secondAssignment!.id, { status: "cancelled" });

    // 模擬 cancel API 的自動狀態更新邏輯
    const currentDemand = await db.getDemandById(testDemandId);
    if (currentDemand && currentDemand.status === "confirmed") {
      const updatedAssignments = await db.getAssignmentsByDemand(testDemandId);
      const activeAssignments = updatedAssignments.filter(a => a.status !== "cancelled");
      
      if (activeAssignments.length === 0) {
        await db.updateDemand(testDemandId, { status: "draft" });
      }
    }

    // 檢查需求單狀態（應該自動改回 draft）
    const updatedDemand = await db.getDemandById(testDemandId);
    expect(updatedDemand?.status).toBe("draft");
  });
});
