import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import { cleanupTestData, TestDataIds } from "./test-utils";

describe("端到端測試：實際工時回填 → 報表輸出", () => {
  const testDataIds: TestDataIds = {
    assignments: [],
    demands: [],
    availability: [],
    workers: [],
    clients: [],
  };









  beforeAll(async () => {
    // 建立測試客戶
    const client = await db.createClient({
      name: "測試客戶-端到端",
      contactName: "測試聯絡人",
      contactPhone: "0912-345-678",
      billingType: "hourly",
      status: "active",
    });
    testDataIds.clients!.push(client.id);

    // 建立測試員工 1
    const worker1 = await db.createWorker({
      name: "測試員工1-端到端",
      phone: "0911-111-111",
      school: "測試學校1",
      hasWorkPermit: 1,
      hasHealthCheck: 1,
      status: "active",
    });
    testWorker1Id = worker1.id;

    // 建立測試員工 2
    const worker2 = await db.createWorker({
      name: "測試員工2-端到端",
      phone: "0922-222-222",
      school: "測試學校2",
      hasWorkPermit: 1,
      hasHealthCheck: 1,
      status: "active",
    });
    testWorker2Id = worker2.id;

    // 建立測試需求單 1（2026/02/15）
    const demand1 = await db.createDemand({
      clientId: testDataIds.clients![0],
      date: new Date("2026-02-15T00:00:00Z"),
      startTime: "09:00",
      endTime: "17:00",
      requiredWorkers: 2,
      location: "測試地點1",
      status: "confirmed",
    });
    testDemand1Id = demand1.id;

    // 建立測試需求單 2（2026/02/20）
    const demand2 = await db.createDemand({
      clientId: testDataIds.clients![0],
      date: new Date("2026-02-20T00:00:00Z"),
      startTime: "10:00",
      endTime: "18:00",
      requiredWorkers: 1,
      location: "測試地點2",
      status: "confirmed",
    });
    testDemand2Id = demand2.id;

    // 建立測試指派 1（員工1 → 需求單1）
    const assignment1 = await db.createAssignment({
      demandId: testDemand1Id,
      workerId: testWorker1Id,
      scheduledStart: new Date("2026-02-15T09:00:00Z"),
      scheduledEnd: new Date("2026-02-15T17:00:00Z"),
      scheduledHours: 480, // 8 小時 = 480 分鐘
      status: "assigned",
    });
    testAssignment1Id = assignment1.id;

    // 建立測試指派 2（員工2 → 需求單1）
    const assignment2 = await db.createAssignment({
      demandId: testDemand1Id,
      workerId: testWorker2Id,
      scheduledStart: new Date("2026-02-15T09:00:00Z"),
      scheduledEnd: new Date("2026-02-15T17:00:00Z"),
      scheduledHours: 480,
      status: "assigned",
    });
    testAssignment2Id = assignment2.id;

    // 建立測試指派 3（員工1 → 需求單2）
    const assignment3 = await db.createAssignment({
      demandId: testDemand2Id,
      workerId: testWorker1Id,
      scheduledStart: new Date("2026-02-20T10:00:00Z"),
      scheduledEnd: new Date("2026-02-20T18:00:00Z"),
      scheduledHours: 480,
      status: "assigned",
    });
    testAssignment3Id = assignment3.id;
  });

  afterAll(async () => {
    // 清理測試資料（依照外鍵約束順序）
    const database = await db.getDb();
    if (database) {
      const { demands, assignments, workers, clients, availability } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      // 1. 刪除 assignments
      if (testAssignment1Id) {
        await database.delete(assignments).where(eq(assignments.id, testAssignment1Id));
      }
      if (testAssignment2Id) {
        await database.delete(assignments).where(eq(assignments.id, testAssignment2Id));
      }
      if (testAssignment3Id) {
        await database.delete(assignments).where(eq(assignments.id, testAssignment3Id));
      }

      // 2. 刪除 demands
      if (testDemand1Id) {
        await database.delete(demands).where(eq(demands.id, testDemand1Id));
      }
      if (testDemand2Id) {
        await database.delete(demands).where(eq(demands.id, testDemand2Id));
      }

      // 3. 刪除 availability
      if (testWorker1Id) {
        await database.delete(availability).where(eq(availability.workerId, testWorker1Id));
      }
      if (testWorker2Id) {
        await database.delete(availability).where(eq(availability.workerId, testWorker2Id));
      }

      // 4. 刪除 workers 和 clients
      if (testWorker1Id) {
        await database.delete(workers).where(eq(workers.id, testWorker1Id));
      }
      if (testWorker2Id) {
        await database.delete(workers).where(eq(workers.id, testWorker2Id));
      }
      if (testDataIds.clients![0]) {
        await database.delete(clients).where(eq(clients.id, testDataIds.clients![0]));
      }
    }
  });

  // ==================== 測試案例 1：實際工時回填 → 員工薪資報表輸出 ====================
  
  it("測試案例 1-1：回填實際工時（員工1，指派1）", async () => {
    // 回填實際工時（實際 09:00-17:30，8.5 小時）
    await db.updateAssignment(testAssignment1Id, {
      actualStart: new Date("2026-02-15T09:00:00Z"),
      actualEnd: new Date("2026-02-15T17:30:00Z"),
      actualHours: 510, // 8.5 小時 = 510 分鐘
      varianceHours: 30, // 多 0.5 小時 = 30 分鐘
      status: "completed",
    });

    const assignment = await db.getAssignmentById(testAssignment1Id);
    expect(assignment?.status).toBe("completed");
    expect(assignment?.actualHours).toBe(510);
  });

  it("測試案例 1-2：員工薪資報表應包含已完成的記錄", async () => {
    const assignments = await db.getAssignmentsByDateRange(
      new Date("2026-02-01T00:00:00Z"),
      new Date("2026-02-28T23:59:59Z")
    );

    // 過濾已完成的記錄
    const completed = assignments.filter(
      (a) => a.status === "completed" && a.actualHours && a.workerId === testWorker1Id
    );

    expect(completed.length).toBeGreaterThanOrEqual(1);
    
    // 檢查是否包含測試指派 1
    const assignment1 = completed.find((a) => a.id === testAssignment1Id);
    expect(assignment1).toBeDefined();
    expect(assignment1?.actualHours).toBe(510);
  });

  it("測試案例 1-3：員工薪資報表的時間和工時資料應正確（不含 NaN）", async () => {
    const assignment = await db.getAssignmentById(testAssignment1Id);
    
    expect(assignment?.actualStart).toBeDefined();
    expect(assignment?.actualEnd).toBeDefined();
    expect(assignment?.actualStart).toBeInstanceOf(Date);
    expect(assignment?.actualEnd).toBeInstanceOf(Date);
    
    // 檢查時間格式化不會產生 NaN
    const actualStart = new Date(assignment!.actualStart!);
    const actualEnd = new Date(assignment!.actualEnd!);
    
    expect(actualStart.getTime()).not.toBeNaN();
    expect(actualEnd.getTime()).not.toBeNaN();
  });

  // ==================== 測試案例 2：實際工時回填 → 客戶工時報表輸出 ====================
  
  it("測試案例 2-1：回填多筆實際工時（員工2，指派2）", async () => {
    // 回填實際工時（實際 09:30-17:00，7.5 小時）
    await db.updateAssignment(testAssignment2Id, {
      actualStart: new Date("2026-02-15T09:30:00Z"),
      actualEnd: new Date("2026-02-15T17:00:00Z"),
      actualHours: 450, // 7.5 小時 = 450 分鐘
      varianceHours: -30, // 少 0.5 小時 = -30 分鐘
      status: "completed",
    });

    const assignment = await db.getAssignmentById(testAssignment2Id);
    expect(assignment?.status).toBe("completed");
    expect(assignment?.actualHours).toBe(450);
  });

  it("測試案例 2-2：客戶工時報表應包含所有已完成的記錄", async () => {
    const allDemands = await db.getAllDemands();
    const clientDemands = allDemands.filter((d) => d.clientId === testDataIds.clients![0]);

    let completedCount = 0;
    let totalMinutes = 0;

    for (const demand of clientDemands) {
      const assignments = await db.getAssignmentsByDemand(demand.id);
      const completed = assignments.filter((a) => a.status === "completed" && a.actualHours);
      
      completedCount += completed.length;
      totalMinutes += completed.reduce((sum, a) => sum + (a.actualHours || 0), 0);
    }

    // 應該有 2 筆已完成的記錄（指派1 和指派2）
    expect(completedCount).toBe(2);
    
    // 總工時應該是 510 + 450 = 960 分鐘（16 小時）
    expect(totalMinutes).toBe(960);
  });

  // ==================== 測試案例 3：未回填實際工時 → 報表不應包含該記錄 ====================
  
  it("測試案例 3-1：未回填實際工時的記錄不應出現在員工薪資報表中", async () => {
    const assignments = await db.getAssignmentsByDateRange(
      new Date("2026-02-01T00:00:00Z"),
      new Date("2026-02-28T23:59:59Z")
    );

    // 過濾已完成的記錄
    const completed = assignments.filter(
      (a) => a.status === "completed" && a.actualHours
    );

    // 檢查指派3（未回填實際工時）是否不在已完成列表中
    const assignment3 = completed.find((a) => a.id === testAssignment3Id);
    expect(assignment3).toBeUndefined();
  });

  it("測試案例 3-2：未回填實際工時的記錄不應出現在客戶工時報表中", async () => {
    const allDemands = await db.getAllDemands();
    const clientDemands = allDemands.filter((d) => d.clientId === testDataIds.clients![0]);

    let completedAssignmentIds: number[] = [];

    for (const demand of clientDemands) {
      const assignments = await db.getAssignmentsByDemand(demand.id);
      const completed = assignments.filter((a) => a.status === "completed" && a.actualHours);
      
      completedAssignmentIds.push(...completed.map((a) => a.id));
    }

    // 檢查指派3（未回填實際工時）是否不在已完成列表中
    expect(completedAssignmentIds).not.toContain(testAssignment3Id);
  });

  // ==================== 測試案例 4：時間範圍過濾測試 ====================
  
  it("測試案例 4-1：回填指派3的實際工時（用於時間範圍測試）", async () => {
    // 回填實際工時（實際 10:00-18:00，8 小時）
    await db.updateAssignment(testAssignment3Id, {
      actualStart: new Date("2026-02-20T10:00:00Z"),
      actualEnd: new Date("2026-02-20T18:00:00Z"),
      actualHours: 480, // 8 小時 = 480 分鐘
      varianceHours: 0,
      status: "completed",
    });

    const assignment = await db.getAssignmentById(testAssignment3Id);
    expect(assignment?.status).toBe("completed");
    expect(assignment?.actualHours).toBe(480);
  });

  it("測試案例 4-2：時間範圍過濾 - 只包含 2026/02/15 的記錄", async () => {
    const assignments = await db.getAssignmentsByDateRange(
      new Date("2026-02-15T00:00:00Z"),
      new Date("2026-02-15T23:59:59Z")
    );

    const completed = assignments.filter((a) => a.status === "completed" && a.actualHours);

    // 應該只包含指派1 和指派2（都在 2026/02/15）
    expect(completed.length).toBe(2);
    
    const assignmentIds = completed.map((a) => a.id);
    expect(assignmentIds).toContain(testAssignment1Id);
    expect(assignmentIds).toContain(testAssignment2Id);
    expect(assignmentIds).not.toContain(testAssignment3Id);
  });

  it("測試案例 4-3：時間範圍過濾 - 只包含 2026/02/20 的記錄", async () => {
    const assignments = await db.getAssignmentsByDateRange(
      new Date("2026-02-20T00:00:00Z"),
      new Date("2026-02-20T23:59:59Z")
    );

    const completed = assignments.filter((a) => a.status === "completed" && a.actualHours);

    // 應該只包含指派3（在 2026/02/20）
    expect(completed.length).toBe(1);
    expect(completed[0].id).toBe(testAssignment3Id);
  });

  it("測試案例 4-4：時間範圍過濾 - 包含整個 2026/02 月份的記錄", async () => {
    const assignments = await db.getAssignmentsByDateRange(
      new Date("2026-02-01T00:00:00Z"),
      new Date("2026-02-28T23:59:59Z")
    );

    const completed = assignments.filter((a) => a.status === "completed" && a.actualHours);

    // 應該包含所有 3 筆已完成的記錄
    expect(completed.length).toBeGreaterThanOrEqual(3);
    
    const assignmentIds = completed.map((a) => a.id);
    expect(assignmentIds).toContain(testAssignment1Id);
    expect(assignmentIds).toContain(testAssignment2Id);
    expect(assignmentIds).toContain(testAssignment3Id);
  });
});
