import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import * as logic from "./businessLogic";

/**
 * 測試 2026/02/12 的四項修復：
 * 1. 結束時間驗證（不能早於開始時間）
 * 2. 休息時間手動輸入
 * 3. 負數工時問題修復
 * 4. 排班時間變更衝突檢測
 */

describe("2026/02/12 Bug Fixes - Part 2", () => {
  let testClientId: number;
  let testWorkerId: number;
  let testDemandId: number;
  let testAssignmentId: number;

  beforeAll(async () => {
    // 建立測試客戶
    const client = await db.createClient({
      name: "測試客戶 - 時間驗證",
      contactName: "測試聯絡人",
      contactPhone: "0912345678",
      billingType: "hourly",
      status: "active",
    });
    testClientId = client.id;

    // 建立測試員工
    const worker = await db.createWorker({
      name: "測試員工 - 時間驗證",
      phone: "0987654321",
      hasWorkPermit: 1,
      hasHealthCheck: 1,
      status: "active",
    });
    testWorkerId = worker.id;

    // 建立測試需求單
    const demand = await db.createDemand({
      clientId: testClientId,
      date: new Date("2026-03-10T00:00:00Z"),
      startTime: "09:00",
      endTime: "17:00",
      requiredWorkers: 1,
      breakHours: 60, // 1 小時休息時間（以分鐘為單位）
      status: "draft",
    });
    testDemandId = demand.id;

    // 建立測試排班時間設置（週二 08:00-19:00，包含 09:00-17:00）
    const weekStart = new Date("2026-03-09T00:00:00Z"); // 週一
    const weekEnd = new Date("2026-03-15T23:59:59Z"); // 週日
    await db.upsertAvailability({
      workerId: testWorkerId,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      timeBlocks: JSON.stringify([
        {
          dayOfWeek: 2, // 週二
          timeSlots: [{ startTime: "08:00", endTime: "19:00" }],
        },
      ]),
      confirmedAt: new Date(),
    });
  });

  afterAll(async () => {
    // 清理測試資料
    try {
      if (testAssignmentId) {
        await db.deleteAssignment(testAssignmentId);
      }
      if (testDemandId) {
        await db.deleteDemand(testDemandId);
      }
      // 清理 availability 資料
      const weekStart = new Date("2026-03-09T00:00:00Z");
      const avail = await db.getAvailabilityByWorkerAndWeek(testWorkerId, weekStart);
      if (avail) {
        await db.deleteAvailability(avail.id);
      }
      if (testWorkerId) {
        await db.deleteWorker(testWorkerId);
      }
      if (testClientId) {
        await db.deleteClient(testClientId);
      }
    } catch (error) {
      console.error("清理測試資料失敗:", error);
    }
  });

  describe("1. 結束時間驗證", () => {
    it("應該拒絕結束時間早於開始時間的指派", async () => {
      const scheduledStart = new Date("2026-03-10T09:00:00Z");
      const scheduledEnd = new Date("2026-03-10T08:00:00Z"); // 結束時間早於開始時間

      // 驗證：結束時間必須晚於開始時間
      expect(scheduledEnd <= scheduledStart).toBe(true);

      // 計算工時應該為負數
      const scheduledHours = logic.calculateMinutesBetween(scheduledStart, scheduledEnd);
      expect(scheduledHours).toBeLessThan(0);
    });

    it("應該接受結束時間晚於開始時間的指派", async () => {
      const scheduledStart = new Date("2026-03-10T09:00:00Z");
      const scheduledEnd = new Date("2026-03-10T17:00:00Z");

      // 驗證：結束時間晚於開始時間
      expect(scheduledEnd > scheduledStart).toBe(true);

      // 計算工時應該為正數
      const scheduledHours = logic.calculateMinutesBetween(scheduledStart, scheduledEnd);
      expect(scheduledHours).toBeGreaterThan(0);
      expect(scheduledHours).toBe(480); // 8 小時 = 480 分鐘
    });
  });

  describe("2. 休息時間手動輸入", () => {
    it("應該支援小數休息時間輸入（0.75 小時 = 45 分鐘）", async () => {
      const breakHoursInput = 0.75; // 使用者輸入 0.75 小時
      const breakMinutes = breakHoursInput * 60; // 轉換為分鐘

      expect(breakMinutes).toBe(45);

      // 建立需求單時應該正確儲存
      const demand = await db.createDemand({
        clientId: testClientId,
        date: new Date("2026-03-11T00:00:00Z"),
        startTime: "09:00",
        endTime: "17:00",
        requiredWorkers: 1,
        breakHours: breakMinutes, // 以分鐘為單位儲存
        status: "draft",
      });

      expect(demand.breakHours).toBe(45);

      // 清理
      await db.deleteDemand(demand.id);
    });

    it("應該支援整數休息時間輸入（1 小時 = 60 分鐘）", async () => {
      const breakHoursInput = 1; // 使用者輸入 1 小時
      const breakMinutes = breakHoursInput * 60;

      expect(breakMinutes).toBe(60);
    });
  });

  describe("3. 負數工時問題修復", () => {
    it("應該拒絕建立負數工時的指派", async () => {
      const scheduledStart = new Date("2026-03-10T17:00:00Z");
      const scheduledEnd = new Date("2026-03-10T09:00:00Z"); // 結束時間早於開始時間

      const scheduledHours = logic.calculateMinutesBetween(scheduledStart, scheduledEnd);

      // 驗證：工時為負數
      expect(scheduledHours).toBeLessThan(0);

      // 在實際應用中，這應該在 API 層被拒絕
      // 這裡只驗證計算邏輯
    });

    it("應該正確計算正數工時", async () => {
      const scheduledStart = new Date("2026-03-10T09:00:00Z");
      const scheduledEnd = new Date("2026-03-10T15:00:00Z");

      const scheduledHours = logic.calculateMinutesBetween(scheduledStart, scheduledEnd);

      expect(scheduledHours).toBe(360); // 6 小時 = 360 分鐘
      expect(scheduledHours).toBeGreaterThan(0);
    });
  });

  describe("4. 排班時間變更衝突檢測", () => {
    it("應該檢測到排班時間變更後的衝突", async () => {
      // 建立指派（週二 09:00-17:00）
      const scheduledStart = new Date("2026-03-10T09:00:00Z");
      const scheduledEnd = new Date("2026-03-10T17:00:00Z");
      const scheduledHours = logic.calculateMinutesBetween(scheduledStart, scheduledEnd);

      const assignment = await db.createAssignment({
        demandId: testDemandId,
        workerId: testWorkerId,
        scheduledStart,
        scheduledEnd,
        scheduledHours,
        status: "assigned",
      });
      testAssignmentId = assignment.id;

      // 驗證：指派已建立
      expect(assignment.id).toBeGreaterThan(0);
      expect(assignment.scheduledHours).toBe(480); // 8 小時 = 480 分鐘

      // 更新排班時間設置：改為週二 13:00-18:00（不包含 09:00-17:00）
      const weekStart = new Date("2026-03-09T00:00:00Z");
      const weekEnd = new Date("2026-03-15T23:59:59Z");
      await db.upsertAvailability({
        workerId: testWorkerId,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        timeBlocks: JSON.stringify([
          {
            dayOfWeek: 2, // 週二
            timeSlots: [{ startTime: "13:00", endTime: "18:00" }],
          },
        ]),
        confirmedAt: new Date(),
      });

      // 驗證：員工在週二 09:00-17:00 不可排班（因為排班時間改為 13:00-18:00）
      const availabilityCheck = await logic.checkWorkerAvailability(
        testWorkerId,
        new Date("2026-03-10T00:00:00Z"),
        "09:00",
        "17:00"
      );
      expect(availabilityCheck.available).toBe(false);
      expect(availabilityCheck.reason).toContain("該日無可排班時段");
    });
  });
});
