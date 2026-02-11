import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";

describe("用工需求單完整流程測試", () => {
  let testClientId: number;
  let testWorkerId1: number;
  let testWorkerId2: number;
  let testDemandId: number;
  let testAssignmentId1: number;
  let testAssignmentId2: number;

  beforeAll(async () => {
    // 建立測試客戶
    const client = await db.createClient({
      name: "測試客戶-需求單流程",
      contactName: "測試聯絡人",
      contactPhone: "0912-345-678",
      billingType: "hourly",
      status: "active",
    });
    testClientId = client.id;

    // 建立測試員工 1
    const worker1 = await db.createWorker({
      name: "測試員工1",
      phone: "0911-111-111",
      school: "測試學校",
      hasWorkPermit: 1,
      hasHealthCheck: 1,
      status: "active",
    });
    testWorkerId1 = worker1.id;

    // 建立測試員工 2
    const worker2 = await db.createWorker({
      name: "測試員工2",
      phone: "0911-222-222",
      school: "測試學校",
      hasWorkPermit: 1,
      hasHealthCheck: 1,
      status: "active",
    });
    testWorkerId2 = worker2.id;
  });

  afterAll(async () => {
    // 清理測試資料
    const database = await db.getDb();
    if (database) {
      const { demands, assignments, workers, clients } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      // 先刪除 assignments
      if (testAssignmentId1) {
        await database.delete(assignments).where(eq(assignments.id, testAssignmentId1));
      }
      if (testAssignmentId2) {
        await database.delete(assignments).where(eq(assignments.id, testAssignmentId2));
      }
      // 再刪除 demand
      if (testDemandId) {
        await database.delete(demands).where(eq(demands.id, testDemandId));
      }
      // 刪除 workers
      if (testWorkerId1) {
        await database.delete(workers).where(eq(workers.id, testWorkerId1));
      }
      if (testWorkerId2) {
        await database.delete(workers).where(eq(workers.id, testWorkerId2));
      }
      // 刪除 client
      if (testClientId) {
        await database.delete(clients).where(eq(clients.id, testClientId));
      }
    }
  });

  it("1. 建立需求單 → 狀態應為 draft，createdAt 應存在", async () => {
    const demandDate = new Date("2026-03-01T10:00:00Z");
    const demand = await db.createDemand({
      clientId: testClientId,
      date: demandDate,
      startTime: "09:00",
      endTime: "17:00",
      requiredWorkers: 2,
      location: "測試地點",
      status: "draft",
    });

    testDemandId = demand.id;

    expect(demand.status).toBe("draft");
    expect(demand.requiredWorkers).toBe(2);
    expect(demand.createdAt).toBeDefined();
    expect(demand.createdAt).toBeInstanceOf(Date);
  });

  it("2. 指派員工 → scheduledHours 應正確儲存", async () => {
    const scheduledStart = new Date("2026-03-01T09:00:00Z");
    const scheduledEnd = new Date("2026-03-01T17:00:00Z");

    const assignment1 = await db.createAssignment({
      demandId: testDemandId,
      workerId: testWorkerId1,
      scheduledStart,
      scheduledEnd,
      scheduledHours: 480, // 8 小時 = 480 分鐘
      status: "assigned",
    });

    testAssignmentId1 = assignment1.id;

    expect(assignment1.scheduledHours).toBe(480);
    expect(assignment1.status).toBe("assigned");
    expect(assignment1.createdAt).toBeDefined();
  });

  it("3. 編輯需求單 → 時間和人數應正確更新", async () => {
    await db.updateDemand(testDemandId, {
      requiredWorkers: 3,
      startTime: "10:00",
      endTime: "18:00",
    });

    const demand = await db.getDemandById(testDemandId);
    expect(demand?.requiredWorkers).toBe(3);
    expect(demand?.startTime).toBe("10:00");
    expect(demand?.endTime).toBe("18:00");
    expect(demand?.updatedAt).toBeDefined();
  });

  it("4. 取消指派 → 狀態應變為 cancelled", async () => {
    await db.updateAssignment(testAssignmentId1, { status: "cancelled" });

    const assignment = await db.getAssignmentById(testAssignmentId1);
    expect(assignment?.status).toBe("cancelled");
  });

  it("5. 取消需求單 → 狀態應變為 cancelled", async () => {
    await db.updateDemand(testDemandId, { status: "cancelled" });

    const demand = await db.getDemandById(testDemandId);
    expect(demand?.status).toBe("cancelled");
  });

  it("6. 時間計算正確性 → 時間差應正確計算", async () => {
    const scheduledStart = new Date("2026-03-02T09:00:00Z");
    const scheduledEnd = new Date("2026-03-02T14:30:00Z");

    // 計算時間差（應該是 5.5 小時 = 330 分鐘）
    const hoursDiff = (scheduledEnd.getTime() - scheduledStart.getTime()) / (1000 * 60);
    expect(hoursDiff).toBe(330);
  });
});
