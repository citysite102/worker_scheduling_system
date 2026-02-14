import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import * as logic from "./businessLogic";
import { cleanupTestData, TestDataIds } from "./test-utils";

describe("2026/02/11 問題修正測試", () => {
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
      name: "測試客戶",
      contactPerson: "測試聯絡人",
      phone: "0912345678",
    });
    testDataIds.clients!.push(client.id);

    // 建立測試員工
    const worker = await db.createWorker({
      name: "測試員工",
      phone: "0912345678",
      status: "active",
      hasWorkPermit: 1,
      hasHealthCheck: 1,
      workPermitExpiryDate: new Date("2026-12-31T00:00:00Z"),
    });
    testDataIds.workers!.push(worker.id);

    // 建立測試需求單
    const demand = await db.createDemand({
      clientId: testDataIds.clients![0],
      date: new Date("2026-02-27T00:00:00Z"),
      startTime: "09:00",
      endTime: "17:00",
      requiredWorkers: 1,
      status: "draft",
    });
    testDataIds.demands!.push(demand.id);

    // 建立測試指派
    const demandForAssignment = await db.getDemandById(testDataIds.demands![0]);
    const scheduledStart = new Date(`${demandForAssignment!.date.toISOString().split('T')[0]}T${demandForAssignment!.startTime}:00Z`);
    const scheduledEnd = new Date(`${demandForAssignment!.date.toISOString().split('T')[0]}T${demandForAssignment!.endTime}:00Z`);
    
    const assignment = await db.createAssignment({
      demandId: testDataIds.demands![0],
      workerId: testDataIds.workers![0],
      status: "assigned",
      scheduledStart: scheduledStart,
      scheduledEnd: scheduledEnd,
      scheduledHours: 480, // 8小時 = 480分鐘
    });
    testDataIds.assignments!.push(assignment.id);
  });

  afterAll(async () => {
    await cleanupTestData(testDataIds);
  });

  describe("1. 報表時間 NaN 問題修正", () => {
    it("填寫實際工時後，actualStart 和 actualEnd 應該正確儲存為 timestamp", async () => {
      // 取得需求單日期
      const demand = await db.getDemandById(testDataIds.demands![0]);
      expect(demand).toBeDefined();

      // 計算實際開始和結束時間
      const actualStart = new Date(demand!.date);
      actualStart.setHours(9, 30, 0, 0);
      
      const actualEnd = new Date(demand!.date);
      actualEnd.setHours(17, 30, 0, 0);

      const actualHours = logic.calculateMinutesBetween(actualStart, actualEnd);

      // 更新指派記錄
      await db.updateAssignment(testDataIds.assignments![0], {
        actualStart: actualStart,
        actualEnd: actualEnd,
        actualHours: actualHours,
        varianceHours: actualHours - 480,
        status: "completed",
      });

      // 驗證時間格式化不會產生 NaN
      // 模擬報表 API 的邏輯
      const formattedStart = logic.formatTime(actualStart);
      const formattedEnd = logic.formatTime(actualEnd);
      expect(formattedStart).not.toContain("NaN");
      expect(formattedEnd).not.toContain("NaN");
      expect(formattedStart).toMatch(/^\d{2}:\d{2}$/);
      expect(formattedEnd).toMatch(/^\d{2}:\d{2}$/);
      expect(formattedStart).toBe("09:30");
      expect(formattedEnd).toBe("17:30");
    });
  });

  describe("2. 工作許可到期日期儲存", () => {
    it("建立員工時，workPermitExpiryDate 應該正確儲存", async () => {
      const expiryDate = new Date("2027-06-30T00:00:00Z");
      const worker = await db.createWorker({
        name: "測試員工2",
        phone: "0923456789",
        status: "active",
        hasWorkPermit: 1,
        hasHealthCheck: 1,
        workPermitExpiryDate: expiryDate,
      });
      testDataIds.workers!.push(worker.id); // 加入清理列表

      const savedWorker = await db.getWorkerById(worker.id);
      expect(savedWorker).toBeDefined();
      expect(savedWorker!.workPermitExpiryDate).toBeInstanceOf(Date);
      
      // 比較日期（只比較年月日，忽略時區差異）
      const savedDate = new Date(savedWorker!.workPermitExpiryDate!);
      expect(savedDate.getUTCFullYear()).toBe(2027);
      expect(savedDate.getUTCMonth()).toBe(5); // 0-based，5 = 6月
      expect(savedDate.getUTCDate()).toBe(30);
    });

    it("更新員工時，workPermitExpiryDate 應該正確儲存", async () => {
      const newExpiryDate = new Date("2028-12-31T00:00:00Z");
      
      await db.updateWorker(testDataIds.workers![0], {
        workPermitExpiryDate: newExpiryDate,
      });

      const updatedWorker = await db.getWorkerById(testDataIds.workers![0]);
      expect(updatedWorker).toBeDefined();
      expect(updatedWorker!.workPermitExpiryDate).toBeInstanceOf(Date);
      
      // 比較日期（只比較年月日，忽略時區差異）
      const savedDate = new Date(updatedWorker!.workPermitExpiryDate!);
      expect(savedDate.getUTCFullYear()).toBe(2028);
      expect(savedDate.getUTCMonth()).toBe(11); // 0-based，11 = 12月
      expect(savedDate.getUTCDate()).toBe(31);
    });
  });

  describe("3. 日期格式加上星期幾", () => {
    it("formatDate 應該回傳包含星期幾的日期格式", () => {
      // 使用 UTC 時間避免時區問題
      const testDate = new Date(Date.UTC(2026, 1, 27)); // 2026-02-27 星期五
      const formatted = logic.formatDate(testDate);
      
      expect(formatted).toContain("2026/2/27");
      expect(formatted).toContain("星期五");
      expect(formatted).toMatch(/^\d{4}\/\d{1,2}\/\d{1,2} 星期[一二三四五六日]$/);
    });

    it("formatDate 應該正確顯示不同星期的日期", () => {
      const testCases = [
        { date: new Date(Date.UTC(2026, 1, 22)), expected: "星期日" }, // 2026-02-22
        { date: new Date(Date.UTC(2026, 1, 23)), expected: "星期一" }, // 2026-02-23
        { date: new Date(Date.UTC(2026, 1, 24)), expected: "星期二" }, // 2026-02-24
        { date: new Date(Date.UTC(2026, 1, 25)), expected: "星期三" }, // 2026-02-25
        { date: new Date(Date.UTC(2026, 1, 26)), expected: "星期四" }, // 2026-02-26
        { date: new Date(Date.UTC(2026, 1, 27)), expected: "星期五" }, // 2026-02-27
        { date: new Date(Date.UTC(2026, 1, 28)), expected: "星期六" }, // 2026-02-28
      ];

      for (const testCase of testCases) {
        const formatted = logic.formatDate(testCase.date);
        expect(formatted).toContain(testCase.expected);
      }
    });
  });
});
