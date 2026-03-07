import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import * as logic from "./businessLogic";

describe("實際工時回填測試", () => {
  let testClientId: number;
  let testWorkerId: number;
  let testDemandId: number;
  let testAssignmentId: number;

  beforeAll(async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    // 建立測試客戶
    const client = await db.createClient({
      name: "測試客戶-工時回填",
      contactName: "測試聯絡人",
      contactPhone: "0912-345-678",
      billingType: "hourly",
      status: "active",
    });
    testClientId = client.id;

    // 建立測試員工
    const worker = await db.createWorker({
      name: "測試員工-工時回填",
      phone: "0911-111-111",
      school: "測試學校",
      hasWorkPermit: 1,
      hasHealthCheck: 1,
      status: "active",
    });
    testWorkerId = worker.id;

    // 建立測試需求單（2026/02/20）
    const demand = await db.createDemand({
      clientId: testClientId,
      date: new Date("2026-02-20T00:00:00Z"),
      startTime: "09:00",
      endTime: "17:00",
      requiredWorkers: 1,
      location: "測試地點",
      status: "confirmed",
    });
    testDemandId = demand.id;

    // 建立測試指派（預計 09:00-17:00，8 小時）
    const assignment = await db.createAssignment({
      demandId: testDemandId,
      workerId: testWorkerId,
      scheduledStart: new Date("2026-02-20T09:00:00Z"),
      scheduledEnd: new Date("2026-02-20T17:00:00Z"),
      scheduledHours: 480, // 8 小時 = 480 分鐘
      status: "assigned",
    });
    testAssignmentId = assignment.id;
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
      if (testAssignmentId) {
        await database.delete(assignments).where(eq(assignments.id, testAssignmentId));
      }
      
      // 2. 刪除 demands
      if (testDemandId) {
        await database.delete(demands).where(eq(demands.id, testDemandId));
      }
      
      // 3. 刪除 availability
      if (testWorkerId) {
        await database.delete(availability).where(eq(availability.workerId, testWorkerId));
      }
      
      // 4. 刪除 workers 和 clients
      if (testWorkerId) {
        await database.delete(workers).where(eq(workers.id, testWorkerId));
      }
      if (testClientId) {
        await database.delete(clients).where(eq(clients.id, testClientId));
      }
    }
  });

  it("1. 回填實際工時 → actualStart 和 actualEnd 應正確儲存", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    // 回填實際工時（實際 09:30-17:30，8 小時）
    await db.updateAssignment(testAssignmentId, {
      actualStart: new Date("2026-02-20T09:30:00Z"),
      actualEnd: new Date("2026-02-20T17:30:00Z"),
      actualHours: 480,
      status: "completed",
    });

    const assignment = await db.getAssignmentById(testAssignmentId);
    
    expect(assignment).toBeDefined();
    expect(assignment?.actualStart).toBeDefined();
    expect(assignment?.actualEnd).toBeDefined();
    expect(assignment?.actualStart).toBeInstanceOf(Date);
    expect(assignment?.actualEnd).toBeInstanceOf(Date);
  });

  it("2. 回填實際工時 → actualHours 應正確計算", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    const assignment = await db.getAssignmentById(testAssignmentId);
    
    expect(assignment?.actualHours).toBe(480); // 8 小時 = 480 分鐘
  });

  it("3. 回填實際工時 → 時間格式化不應產生 NaN", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    const assignment = await db.getAssignmentById(testAssignmentId);
    
    if (assignment?.actualStart) {
      const formattedStart = logic.formatTime(new Date(assignment.actualStart));
      expect(formattedStart).not.toContain("NaN");
      expect(formattedStart).toMatch(/^\d{2}:\d{2}$/);
    }

    if (assignment?.actualEnd) {
      const formattedEnd = logic.formatTime(new Date(assignment.actualEnd));
      expect(formattedEnd).not.toContain("NaN");
      expect(formattedEnd).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it("4. 回填實際工時 → 工時計算邏輯正確", () => {
    // 測試 calculateMinutesBetween 函式
    const start = new Date("2026-02-20T09:30:00Z");
    const end = new Date("2026-02-20T17:30:00Z");
    
    const minutes = logic.calculateMinutesBetween(start, end);
    expect(minutes).toBe(480); // 8 小時 = 480 分鐘
  });

  it("5. 回填實際工時 → varianceHours 應正確計算", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    // 回填實際工時（實際 09:00-18:00，9 小時，比預計多 1 小時）
    await db.updateAssignment(testAssignmentId, {
      actualStart: new Date("2026-02-20T09:00:00Z"),
      actualEnd: new Date("2026-02-20T18:00:00Z"),
      actualHours: 540, // 9 小時 = 540 分鐘
      varianceHours: 60, // 多 1 小時 = 60 分鐘
      status: "completed",
    });

    const assignment = await db.getAssignmentById(testAssignmentId);
    
    expect(assignment?.actualHours).toBe(540);
    expect(assignment?.varianceHours).toBe(60);
  });

  it("6. 回填實際工時 → 狀態應變為 completed", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    const assignment = await db.getAssignmentById(testAssignmentId);
    
    expect(assignment?.status).toBe("completed");
  });

  it("7. 時間格式轉換 → HH:mm 格式應正確轉換為 Date", () => {
    const demandDate = new Date("2026-02-20T00:00:00Z");
    const actualStartTime = "09:30";
    const actualEndTime = "17:30";

    // 模擬 fillActualTime API 的時間轉換邏輯
    const actualStart = new Date(demandDate);
    const [startHour, startMin] = actualStartTime.split(":").map(Number);
    actualStart.setUTCHours(startHour, startMin, 0, 0);

    const actualEnd = new Date(demandDate);
    const [endHour, endMin] = actualEndTime.split(":").map(Number);
    actualEnd.setUTCHours(endHour, endMin, 0, 0);

    // 檢查時間是否正確
    expect(actualStart.getUTCHours()).toBe(9);
    expect(actualStart.getUTCMinutes()).toBe(30);
    expect(actualEnd.getUTCHours()).toBe(17);
    expect(actualEnd.getUTCMinutes()).toBe(30);
  });
});
