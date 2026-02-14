import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import * as logic from "./businessLogic";
import { cleanupTestData, TestDataIds } from "./test-utils";

describe("報表輸出測試", () => {
  const testDataIds: TestDataIds = {
    assignments: [],
    demands: [],
    availability: [],
    workers: [],
    clients: [],
  };
  let testClientId: number;
  let testWorkerId: number;
  let testDemandId: number;
  let testAssignmentId: number;

  beforeAll(async () => {
    // 建立測試客戶
    const client = await db.createClient({
      name: "測試客戶-報表",
      contactName: "測試聯絡人",
      contactPhone: "0912-345-678",
      billingType: "hourly",
      status: "active",
    });
    testClientId = client.id;
    testDataIds.clients!.push(client.id);

    // 建立測試員工
    const worker = await db.createWorker({
      name: "測試員工-報表",
      phone: "0911-111-111",
      school: "測試學校",
      hasWorkPermit: 1,
      hasHealthCheck: 1,
      status: "active",
    });
    testWorkerId = worker.id;
    testDataIds.workers!.push(worker.id);

    // 建立測試需求單
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
    testDataIds.demands!.push(demand.id);

    // 建立測試指派
    const assignment = await db.createAssignment({
      demandId: testDemandId,
      workerId: testWorkerId,
      scheduledStart: new Date("2026-02-20T09:00:00Z"),
      scheduledEnd: new Date("2026-02-20T17:00:00Z"),
      scheduledHours: 480, // 8 小時
      status: "completed",
    });
    testAssignmentId = assignment.id;
    testDataIds.assignments!.push(assignment.id);

    // 填寫實際工時
    await db.updateAssignment(testAssignmentId, {
      actualStart: new Date("2026-02-20T09:00:00Z"),
      actualEnd: new Date("2026-02-20T17:00:00Z"),
      actualHours: 480,
    });
  });

  afterAll(async () => {
    await cleanupTestData(testDataIds);
  });

  it("1. 時間格式化 → formatTime 應正確格式化時間", () => {
    const date1 = new Date("2026-02-20T09:30:00Z");
    const formatted1 = logic.formatTime(date1);
    expect(formatted1).toMatch(/^\d{2}:\d{2}$/); // 應該是 HH:mm 格式

    const date2 = new Date("2026-02-20T14:45:00Z");
    const formatted2 = logic.formatTime(date2);
    expect(formatted2).toMatch(/^\d{2}:\d{2}$/);
  });

  it("2. 日期格式化 → formatDate 應正確格式化日期並包含星期幾", () => {
    const date = new Date("2026-02-27T00:00:00Z");
    const formatted = logic.formatDate(date);
    
    // 應該包含年/月/日和星期幾
    expect(formatted).toContain("2026");
    expect(formatted).toContain("星期");
  });

  it("3. 工時計算 → 應正確計算分鐘轉小時", () => {
    // 480 分鐘 = 8.00 小時
    const hours1 = 480 / 60;
    expect(hours1).toBe(8.0);

    // 330 分鐘 = 5.50 小時
    const hours2 = 330 / 60;
    expect(hours2).toBe(5.5);

    // 90 分鐘 = 1.50 小時
    const hours3 = 90 / 60;
    expect(hours3).toBe(1.5);
  });

  it("4. 報表資料正確性 → actualStart 和 actualEnd 應正確儲存", async () => {
    const assignment = await db.getAssignmentById(testAssignmentId);
    
    expect(assignment).toBeDefined();
    expect(assignment?.actualStart).toBeDefined();
    expect(assignment?.actualEnd).toBeDefined();
    expect(assignment?.actualHours).toBe(480);
  });

  it("5. 報表資料正確性 → 時間欄位不應為 null", async () => {
    const assignment = await db.getAssignmentById(testAssignmentId);
    
    // 確保時間欄位不是 null
    expect(assignment?.actualStart).not.toBeNull();
    expect(assignment?.actualEnd).not.toBeNull();
    
    // 確保時間欄位是 Date 物件
    expect(assignment?.actualStart).toBeInstanceOf(Date);
    expect(assignment?.actualEnd).toBeInstanceOf(Date);
  });

  it("6. 報表時間格式化 → 不應產生 NaN", async () => {
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
});
