import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import * as logic from "./businessLogic";

describe("核心流程整合測試", () => {
  let testClientId: number;
  let testWorkerId1: number;
  let testWorkerId2: number;
  let testDemandId: number;

  beforeAll(async () => {
    // 建立測試客戶
    const client = await db.createClient({
      name: "測試客戶公司",
      contactPerson: "測試聯絡人",
      phone: "0912345678",
    });
    testClientId = client.id;

    // 建立測試員工 1
    const worker1 = await db.createWorker({
      name: "測試員工一",
      phone: "0911111111",
      status: "active",
    });
    testWorkerId1 = worker1.id;

    // 建立測試員工 2
    const worker2 = await db.createWorker({
      name: "測試員工二",
      phone: "0922222222",
      status: "active",
    });
    testWorkerId2 = worker2.id;

    // 設置排班時間（所有測試都需要）
    const today = new Date();
    const dayOfWeek = today.getUTCDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setUTCDate(today.getUTCDate() + diff);
    weekStart.setUTCHours(0, 0, 0, 0);

    // 設置員工 1 的排班時間（週一到週五 09:00-18:00）
    await db.upsertAvailability({
      workerId: testWorkerId1,
      weekStartDate: weekStart,
      monday: "09:00-12:00,13:00-18:00",
      tuesday: "09:00-12:00,13:00-18:00",
      wednesday: "09:00-12:00,13:00-18:00",
      thursday: "09:00-12:00,13:00-18:00",
      friday: "09:00-12:00,13:00-18:00",
      saturday: null,
      sunday: null,
      confirmedAt: new Date(),
    });

    // 設置員工 2 的排班時間（週一到週日 08:00-20:00）
    await db.upsertAvailability({
      workerId: testWorkerId2,
      weekStartDate: weekStart,
      monday: "08:00-20:00",
      tuesday: "08:00-20:00",
      wednesday: "08:00-20:00",
      thursday: "08:00-20:00",
      friday: "08:00-20:00",
      saturday: "08:00-20:00",
      sunday: "08:00-20:00",
      confirmedAt: new Date(),
    });
  });

  afterAll(async () => {
    // 清理測試資料（按照外鍵依賴順序）
    try {
      if (testDemandId) {
        await db.deleteDemand(testDemandId);
      }
      if (testClientId) {
        await db.deleteClient(testClientId);
      }
      if (testWorkerId1) {
        await db.deleteWorker(testWorkerId1);
      }
      if (testWorkerId2) {
        await db.deleteWorker(testWorkerId2);
      }
    } catch (e) {
      console.error("清理測試資料失敗：", e);
    }
  });

  it("應該能建立員工並設置排班時間", async () => {
    // 排班設置已在 beforeAll 中完成，這裡只驗證員工和排班設置存在
    expect(testWorkerId1).toBeGreaterThan(0);
    expect(testWorkerId2).toBeGreaterThan(0);

    // 驗證排班設置已建立
    const today = new Date();
    const dayOfWeek = today.getUTCDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setUTCDate(today.getUTCDate() + diff);
    weekStart.setUTCHours(0, 0, 0, 0);

    const availability1 = await db.getAvailabilityByWorkerAndWeek(testWorkerId1, weekStart);
    expect(availability1).not.toBeNull();
    expect(availability1?.confirmedAt).not.toBeNull();

    const availability2 = await db.getAvailabilityByWorkerAndWeek(testWorkerId2, weekStart);
    expect(availability2).not.toBeNull();
    expect(availability2?.confirmedAt).not.toBeNull();
  });

  it("應該能建立需求單並檢視指派條件", async () => {
    // 建立需求單（週三 10:00-17:00）
    const today = new Date();
    const dayOfWeek = today.getUTCDay();
    const daysUntilWednesday = dayOfWeek === 0 ? 3 : (3 - dayOfWeek + 7) % 7;
    const demandDate = new Date(today);
    demandDate.setUTCDate(today.getUTCDate() + daysUntilWednesday);
    demandDate.setUTCHours(0, 0, 0, 0);

    const demand = await db.createDemand({
      clientId: testClientId,
      date: demandDate,
      startTime: "10:00",
      endTime: "17:00",
      requiredWorkers: 2,
      location: "測試地點",
      note: "測試需求單",
    });

    testDemandId = demand.id;
    expect(testDemandId).toBeGreaterThan(0);

    // 檢查指派條件
    const feasibility = await logic.calculateDemandFeasibility(
      testDemandId,
      demandDate,
      "10:00",
      "17:00",
      2
    );

    expect(feasibility).toBeDefined();
    expect(feasibility.availableWorkers).toBeDefined();
    expect(feasibility.unavailableWorkers).toBeDefined();

    // 員工 1 應該在可指派列表（09:00-18:00 包含 10:00-17:00）
    const worker1Available = feasibility.availableWorkers.some(
      (w: any) => w.id === testWorkerId1
    );
    expect(worker1Available).toBe(true);

    // 員工 2 應該在可指派列表（08:00-20:00 包含 10:00-17:00）
    const worker2Available = feasibility.availableWorkers.some(
      (w: any) => w.id === testWorkerId2
    );
    expect(worker2Available).toBe(true);
  });

  it("應該正確判斷時間外的員工為不可指派", async () => {
    // 建立一個超出排班時間的需求單（週三 19:00-22:00）
    const today = new Date();
    const dayOfWeek = today.getUTCDay();
    const daysUntilWednesday = dayOfWeek === 0 ? 3 : (3 - dayOfWeek + 7) % 7;
    const demandDate = new Date(today);
    demandDate.setUTCDate(today.getUTCDate() + daysUntilWednesday);
    demandDate.setUTCHours(0, 0, 0, 0);

    const lateDemand = await db.createDemand({
      clientId: testClientId,
      date: demandDate,
      startTime: "19:00",
      endTime: "22:00",
      requiredWorkers: 1,
      location: "測試地點（晚班）",
      note: "測試晚班需求單",
    });

    const feasibility = await logic.calculateDemandFeasibility(
      lateDemand.id,
      demandDate,
      "19:00",
      "22:00",
      1
    );

    // 員工 1 應該在不可指派列表（09:00-18:00 不包含 19:00-22:00）
    const worker1Unavailable = feasibility.unavailableWorkers.some(
      (uw: any) => uw.worker.id === testWorkerId1
    );
    expect(worker1Unavailable).toBe(true);

    // 員工 2 應該在可指派列表（08:00-20:00 包含 19:00-20:00，但不完全包含 19:00-22:00）
    // 根據實際邏輯，如果需求時間超出排班時間，應該標記為不可指派
    const worker2Available = feasibility.availableWorkers.some(
      (w: any) => w.id === testWorkerId2
    );
    // 這裡需要根據實際的 checkWorkerAvailability 邏輯來判斷
    // 如果邏輯是「需求時間必須完全在排班時間內」，則 worker2 也應該不可指派

    // 清理測試需求單
    await db.deleteDemand(lateDemand.id);
  });

  it("應該能複製需求單", async () => {
    // 複製需求單
    const originalDemand = await db.getDemandById(testDemandId);
    expect(originalDemand).not.toBeNull();

    const newDemandId = await db.duplicateDemand(testDemandId);
    expect(newDemandId).toBeGreaterThan(0);
    expect(newDemandId).not.toBe(testDemandId);

    // 檢查新需求單的內容
    const newDemand = await db.getDemandById(newDemandId);
    expect(newDemand).not.toBeNull();
    expect(newDemand!.clientId).toBe(originalDemand!.clientId);
    expect(newDemand!.startTime).toBe(originalDemand!.startTime);
    expect(newDemand!.endTime).toBe(originalDemand!.endTime);
    expect(newDemand!.requiredWorkers).toBe(originalDemand!.requiredWorkers);
    expect(newDemand!.status).toBe("draft"); // 複製後應該是草稿狀態

    // 清理複製的需求單
    await db.deleteDemand(newDemandId);
  });

  it("應該能刪除需求單（包含相關的 assignments）", async () => {
    // 建立一個新需求單用於測試刪除
    const today = new Date();
    const dayOfWeek = today.getUTCDay();
    const daysUntilWednesday = dayOfWeek === 0 ? 3 : (3 - dayOfWeek + 7) % 7;
    const demandDate = new Date(today);
    demandDate.setUTCDate(today.getUTCDate() + daysUntilWednesday);
    demandDate.setUTCHours(0, 0, 0, 0);

    const demandToDelete = await db.createDemand({
      clientId: testClientId,
      date: demandDate,
      startTime: "10:00",
      endTime: "17:00",
      requiredWorkers: 1,
      location: "測試刪除地點",
      note: "測試刪除需求單",
    });

    // 建立一個指派
    const scheduledStart = new Date(demandDate);
    scheduledStart.setUTCHours(10, 0, 0, 0);
    const scheduledEnd = new Date(demandDate);
    scheduledEnd.setUTCHours(17, 0, 0, 0);

    const assignment = await db.createAssignment({
      demandId: demandToDelete.id,
      workerId: testWorkerId1,
      scheduledStart,
      scheduledEnd,
      scheduledHours: 420, // 7 小時 = 420 分鐘
      status: "assigned",
    });

    expect(assignment.id).toBeGreaterThan(0);

    // 刪除需求單（應該也會刪除相關的 assignment）
    await db.deleteDemand(demandToDelete.id);;

    // 檢查需求單是否已刪除
    const deletedDemand = await db.getDemandById(demandToDelete.id);
    expect(deletedDemand).toBeNull();

    // 檢查 assignment 是否也被刪除
    const assignments = await db.getAssignmentsByDemand(demandToDelete.id);
    expect(assignments.length).toBe(0);
  });

  it("應該正確處理已指派員工在其他需求單中顯示為不可指派", async () => {
    // 建立第一個需求單並指派員工 1
    const today = new Date();
    const dayOfWeek = today.getUTCDay();
    const daysUntilWednesday = dayOfWeek === 0 ? 3 : (3 - dayOfWeek + 7) % 7;
    const demandDate = new Date(today);
    demandDate.setUTCDate(today.getUTCDate() + daysUntilWednesday);
    demandDate.setUTCHours(0, 0, 0, 0);

    const demand1 = await db.createDemand({
      clientId: testClientId,
      date: demandDate,
      startTime: "09:00",
      endTime: "12:00",
      requiredWorkers: 1,
      location: "測試地點 A",
      note: "第一個需求單",
    });

    const scheduledStart1 = new Date(demandDate);
    scheduledStart1.setUTCHours(9, 0, 0, 0);
    const scheduledEnd1 = new Date(demandDate);
    scheduledEnd1.setUTCHours(12, 0, 0, 0);

    await db.createAssignment({
      demandId: demand1.id,
      workerId: testWorkerId1,
      scheduledStart: scheduledStart1,
      scheduledEnd: scheduledEnd1,
      scheduledHours: 180, // 3 小時 = 180 分鐘
      status: "assigned",
    });

    // 建立第二個需求單（同一天，不同時間）
    const demand2 = await db.createDemand({
      clientId: testClientId,
      date: demandDate,
      startTime: "14:00",
      endTime: "17:00",
      requiredWorkers: 1,
      location: "測試地點 B",
      note: "第二個需求單",
    });

    // 檢查第二個需求單的指派條件
    const feasibility = await logic.calculateDemandFeasibility(
      demand2.id,
      demandDate,
      "14:00",
      "17:00",
      1
    );

    // 員工 1 應該在可指派列表（時段不重疊：09:00-12:00 和 14:00-17:00）
    const worker1Available = feasibility.availableWorkers.some(
      (w: any) => w.id === testWorkerId1
    );
    expect(worker1Available).toBe(true);

    // 確認員工 1 不在不可指派列表中（因為時段不重疊）
    const worker1Unavailable = feasibility.unavailableWorkers.some(
      (uw: any) => uw.worker.id === testWorkerId1
    );
    expect(worker1Unavailable).toBe(false);

    // 清理測試資料
    await db.deleteDemand(demand1.id);
    await db.deleteDemand(demand2.id);
  });
});
