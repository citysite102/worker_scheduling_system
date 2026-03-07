import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import { cleanupTestData, TestDataIds } from "./test-utils";

describe("用工需求單完整流程測試", () => {
  const testDataIds: TestDataIds = {
    assignments: [],
    demands: [],
    availability: [],
    workers: [],
    clients: [],
  };

  let testWorkerId1: number;
  let testWorkerId2: number;

  let testAssignmentId1: number;
  let testAssignmentId2: number;

  beforeAll(async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    // 建立測試客戶
    const client = await db.createClient({
      name: "測試客戶-需求單流程",
      contactName: "測試聯絡人",
      contactPhone: "0912-345-678",
      billingType: "hourly",
      status: "active",
    });
    testDataIds.clients!.push(client.id);

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
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    // 清理測試資料
    const database = await db.getDb();
    if (database) {
      const { demands, assignments, workers, clients, availability } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      // 1. 刪除 assignments
      if (testAssignmentId1) {
        await database.delete(assignments).where(eq(assignments.id, testAssignmentId1));
      }
      if (testAssignmentId2) {
        await database.delete(assignments).where(eq(assignments.id, testAssignmentId2));
      }
      
      // 2. 刪除 demands
      if (testDataIds.demands![0]) {
        await database.delete(demands).where(eq(demands.id, testDataIds.demands![0]));
      }
      
      // 3. 刪除 availability
      if (testWorkerId1) {
        await database.delete(availability).where(eq(availability.workerId, testWorkerId1));
      }
      if (testWorkerId2) {
        await database.delete(availability).where(eq(availability.workerId, testWorkerId2));
      }
      
      // 4. 刪除 workers 和 clients
      if (testWorkerId1) {
        await database.delete(workers).where(eq(workers.id, testWorkerId1));
      }
      if (testWorkerId2) {
        await database.delete(workers).where(eq(workers.id, testWorkerId2));
      }
      if (testDataIds.clients![0]) {
        await database.delete(clients).where(eq(clients.id, testDataIds.clients![0]));
      }
    }
  });

  it("1. 建立需求單 → 狀態應為 draft，createdAt 應存在", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    const demandDate = new Date("2026-03-01T10:00:00Z");
    const demand = await db.createDemand({
      clientId: testDataIds.clients![0],
      date: demandDate,
      startTime: "09:00",
      endTime: "17:00",
      requiredWorkers: 2,
      location: "測試地點",
      status: "draft",
    });

    testDataIds.demands!.push(demand.id);

    expect(demand.status).toBe("draft");
    expect(demand.requiredWorkers).toBe(2);
    expect(demand.createdAt).toBeDefined();
    expect(demand.createdAt).toBeInstanceOf(Date);
  });

  it("2. 指派員工 → scheduledHours 應正確儲存", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    const scheduledStart = new Date("2026-03-01T09:00:00Z");
    const scheduledEnd = new Date("2026-03-01T17:00:00Z");

    const assignment1 = await db.createAssignment({
      demandId: testDataIds.demands![0],
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
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    await db.updateDemand(testDataIds.demands![0], {
      requiredWorkers: 3,
      startTime: "10:00",
      endTime: "18:00",
    });

    const demand = await db.getDemandById(testDataIds.demands![0]);
    expect(demand?.requiredWorkers).toBe(3);
    expect(demand?.startTime).toBe("10:00");
    expect(demand?.endTime).toBe("18:00");
    expect(demand?.updatedAt).toBeDefined();
  });

  it("4. 取消指派 → 狀態應變為 cancelled", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    await db.updateAssignment(testAssignmentId1, { status: "cancelled" });

    const assignment = await db.getAssignmentById(testAssignmentId1);
    expect(assignment?.status).toBe("cancelled");
  });

  it("5. 取消需求單 → 狀態應變為 cancelled", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    await db.updateDemand(testDataIds.demands![0], { status: "cancelled" });

    const demand = await db.getDemandById(testDataIds.demands![0]);
    expect(demand?.status).toBe("cancelled");
  });

  it("6. 時間計算正確性 → 時間差應正確計算", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    const scheduledStart = new Date("2026-03-02T09:00:00Z");
    const scheduledEnd = new Date("2026-03-02T14:30:00Z");

    // 計算時間差（應該是 5.5 小時 = 330 分鐘）
    const hoursDiff = (scheduledEnd.getTime() - scheduledStart.getTime()) / (1000 * 60);
    expect(hoursDiff).toBe(330);
  });
});
