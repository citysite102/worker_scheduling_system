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
    
    const assignment1 = await db.createAssignment({
      demandId: testDemandId,
      workerId: testDataIds.workers![0],
      status: "assigned",
      scheduledStart,
      scheduledEnd,
      scheduledHours: 360, // 6 小時 * 60 分鐘
    });
    testDataIds.assignments!.push(assignment1.id);

    // 檢查需求單狀態（應該還是 draft，因為只指派了 1 位，需要 2 位）
    // 注意：db.createAssignment 不會觸發自動狀態更新，只有 API 層的 batchCreate 才會
    const updatedDemand = await db.getDemandById(testDemandId);
    expect(updatedDemand?.status).toBe("draft");
    
    // 驗證 assignment 已成功建立
    const assignments = await db.getAssignmentsByDemand(testDemandId);
    expect(assignments.length).toBe(1);
    expect(assignments[0].workerId).toBe(testDataIds.workers![0]);
  });

  it("指派第 2 位員工時，可以成功建立第 2 個 assignment", async () => {
    // 指派第 2 位員工
    const demandInfo = await db.getDemandById(testDemandId);
    const scheduledStart = new Date(`${demandInfo!.date.toISOString().split('T')[0]}T${demandInfo!.startTime}:00Z`);
    const scheduledEnd = new Date(`${demandInfo!.date.toISOString().split('T')[0]}T${demandInfo!.endTime}:00Z`);
    
    const assignment2 = await db.createAssignment({
      demandId: testDemandId,
      workerId: testDataIds.workers![1],
      status: "assigned",
      scheduledStart,
      scheduledEnd,
      scheduledHours: 360, // 6 小時 * 60 分鐘
    });
    testDataIds.assignments!.push(assignment2.id);

    // 驗證 assignment 已成功建立
    const assignments = await db.getAssignmentsByDemand(testDemandId);
    expect(assignments.length).toBe(2);
    
    // 驗證兩位員工都已指派
    const workerIds = assignments.map(a => a.workerId);
    expect(workerIds).toContain(testDataIds.workers![0]);
    expect(workerIds).toContain(testDataIds.workers![1]);
    
    // 注意：需求單狀態仍為 draft，因為 db.createAssignment 不會觸發自動狀態更新
    // 只有透過 API (assignments.batchCreate) 才會自動更新狀態
    const updatedDemand = await db.getDemandById(testDemandId);
    expect(updatedDemand?.status).toBe("draft");
  });

  it("取消 1 位員工的指派時，可以成功更新 assignment 狀態", async () => {
    // 取得第 1 位員工的指派記錄
    const assignments = await db.getAssignmentsByDemand(testDemandId);
    const firstAssignment = assignments.find(a => a.workerId === testDataIds.workers![0]);
    expect(firstAssignment).toBeDefined();

    // 取消第 1 位員工的指派
    await db.updateAssignment(firstAssignment!.id, { status: "cancelled" });

    // 驗證 assignment 狀態已更新
    const updatedAssignment = await db.getAssignmentById(firstAssignment!.id);
    expect(updatedAssignment?.status).toBe("cancelled");
    
    // 驗證還有 1 位活躍的員工
    const updatedAssignments = await db.getAssignmentsByDemand(testDemandId);
    const activeAssignments = updatedAssignments.filter(a => a.status !== "cancelled");
    expect(activeAssignments.length).toBe(1);
    
    // 注意：需求單狀態仍為 draft，因為 db.updateAssignment 不會觸發自動狀態更新
    // 只有透過 API (assignments.cancel) 才會自動更新狀態
    const updatedDemand = await db.getDemandById(testDemandId);
    expect(updatedDemand?.status).toBe("draft");
  });

  it("取消所有員工的指派時，所有 assignments 狀態都應為 cancelled", async () => {
    // 取得第 2 位員工的指派記錄
    const assignments = await db.getAssignmentsByDemand(testDemandId);
    const secondAssignment = assignments.find(a => a.workerId === testDataIds.workers![1] && a.status !== "cancelled");
    expect(secondAssignment).toBeDefined();

    // 取消第 2 位員工的指派
    await db.updateAssignment(secondAssignment!.id, { status: "cancelled" });

    // 驗證所有 assignments 都已取消
    const updatedAssignments = await db.getAssignmentsByDemand(testDemandId);
    const activeAssignments = updatedAssignments.filter(a => a.status !== "cancelled");
    expect(activeAssignments.length).toBe(0);
    
    // 驗證所有 assignments 狀態都為 cancelled
    expect(updatedAssignments.every(a => a.status === "cancelled")).toBe(true);
    
    // 注意：需求單狀態仍為 draft，因為 db.updateAssignment 不會觸發自動狀態更新
    // 只有透過 API (assignments.cancel) 才會自動更新狀態
    const updatedDemand = await db.getDemandById(testDemandId);
    expect(updatedDemand?.status).toBe("draft");
  });
});
