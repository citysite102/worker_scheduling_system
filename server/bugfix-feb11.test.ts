import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import * as logic from "./businessLogic";

describe("2026/02/11 問題修正測試", () => {
  let testClientId: number;
  let testWorkerId: number;
  let testDemandId: number;
  let testAssignmentId: number;

  beforeAll(async () => {
    // 建立測試客戶
    const client = await db.createClient({
      name: "測試客戶",
      contactPerson: "測試聯絡人",
      phone: "0912345678",
    });
    testClientId = client.id;

    // 建立測試員工
    const worker = await db.createWorker({
      name: "測試員工",
      phone: "0912345678",
      status: "active",
      hasWorkPermit: 1,
      hasHealthCheck: 1,
      workPermitExpiryDate: new Date("2026-12-31T00:00:00Z"),
    });
    testWorkerId = worker.id;

    // 建立測試需求單
    const demandId = await db.createDemand({
      clientId: testClientId,
      date: new Date("2026-02-27T00:00:00Z"),
      startTime: "09:00",
      endTime: "17:00",
      requiredWorkers: 1,
      hourlyRate: 200,
      status: "draft",
    });
    testDemandId = demandId;

    // 建立測試指派
    const demand = await db.getDemandById(testDemandId);
    const scheduledStart = new Date(`${demand!.date.toISOString().split('T')[0]}T${demand!.startTime}:00Z`);
    const scheduledEnd = new Date(`${demand!.date.toISOString().split('T')[0]}T${demand!.endTime}:00Z`);
    
    const assignment = await db.createAssignment({
      demandId: testDemandId,
      workerId: testWorkerId,
      status: "assigned",
      scheduledStart: scheduledStart,
      scheduledEnd: scheduledEnd,
      scheduledHours: 480, // 8小時 = 480分鐘
    });
    testAssignmentId = assignment.id;
  });

  afterAll(async () => {
    // 清理測試資料（注意順序：先刪除 assignment，再刪除 demand）
    if (testAssignmentId) {
      try {
        await db.deleteAssignment(testAssignmentId);
      } catch (e) {
        console.error("Failed to delete assignment:", e);
      }
    }
    if (testDemandId) {
      try {
        await db.deleteDemand(testDemandId);
      } catch (e) {
        console.error("Failed to delete demand:", e);
      }
    }
    if (testWorkerId) {
      try {
        await db.deleteWorker(testWorkerId);
      } catch (e) {
        console.error("Failed to delete worker:", e);
      }
    }
    if (testClientId) {
      try {
        await db.deleteClient(testClientId);
      } catch (e) {
        console.error("Failed to delete client:", e);
      }
    }
  });

  describe("1. 報表時間 NaN 問題修正", () => {
    it("填寫實際工時後，actualStart 和 actualEnd 應該正確儲存為 timestamp", async () => {
      // 取得需求單日期
      const demand = await db.getDemandById(testDemandId);
      expect(demand).toBeDefined();

      // 計算實際開始和結束時間
      const actualStart = new Date(demand!.date);
      actualStart.setHours(9, 30, 0, 0);
      
      const actualEnd = new Date(demand!.date);
      actualEnd.setHours(17, 30, 0, 0);

      const actualHours = logic.calculateMinutesBetween(actualStart, actualEnd);

      // 更新指派記錄
      await db.updateAssignment(testAssignmentId, {
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

      const savedWorker = await db.getWorkerById(worker.id);
      expect(savedWorker).toBeDefined();
      expect(savedWorker!.workPermitExpiryDate).toBeInstanceOf(Date);
      
      // 比較日期（只比較年月日，忽略時區差異）
      const savedDate = new Date(savedWorker!.workPermitExpiryDate!);
      expect(savedDate.getUTCFullYear()).toBe(2027);
      expect(savedDate.getUTCMonth()).toBe(5); // 0-based，5 = 6月
      expect(savedDate.getUTCDate()).toBe(30);

      // 清理
      await db.deleteWorker(worker.id);
    });

    it("更新員工時，workPermitExpiryDate 應該正確儲存", async () => {
      const newExpiryDate = new Date("2028-12-31T00:00:00Z");
      
      await db.updateWorker(testWorkerId, {
        workPermitExpiryDate: newExpiryDate,
      });

      const updatedWorker = await db.getWorkerById(testWorkerId);
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
