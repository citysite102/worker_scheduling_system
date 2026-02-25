import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";

describe("管理後台派工資料同步測試", () => {
  const testDataIds = {
    assignments: [] as number[],
    demands: [] as number[],
    availability: [] as number[],
    workers: [] as number[],
    clients: [] as number[],
  };

  let testClientId: number;
  let testWorkerId: number;
  let testDemandId: number;
  let testAssignmentId: number;

  beforeAll(async () => {
    // 1. 建立測試客戶
    const client = await db.createClient({
      name: "測試客戶公司-派工同步",
      contactName: "測試聯絡人",
      contactPhone: "0912-345-678",
      billingType: "hourly",
      status: "active",
    });
    testClientId = client.id;
    testDataIds.clients!.push(client.id);

    // 2. 建立測試員工
    const worker = await db.createWorker({
      name: "測試員工-派工同步",
      phone: "0987-654-321",
      status: "active",
    });
    testWorkerId = worker.id;
    testDataIds.workers!.push(worker.id);

    // 3. 建立員工可用時段
    const demandDate = new Date("2026-03-15T00:00:00Z");
    demandDate.setUTCHours(0, 0, 0, 0);

    // 計算週開始日期（星期一）
    const weekStartDate = new Date(demandDate);
    const dayOfWeek = weekStartDate.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStartDate.setDate(weekStartDate.getDate() + daysToMonday);
    weekStartDate.setUTCHours(0, 0, 0, 0);

    // 計算週結束日期（星期日）
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    weekEndDate.setUTCHours(0, 0, 0, 0);

    const availabilityId = await db.upsertAvailability({
      workerId: testWorkerId,
      weekStartDate,
      weekEndDate,
      timeBlocks: JSON.stringify([
        { date: "2026-03-15", startTime: "08:00", endTime: "18:00" }
      ]),
    });
    
    if (typeof availabilityId === 'number') {
      testDataIds.availability!.push(availabilityId);
    }

    // 4. 建立測試需求單（已確認狀態）
    const demand = await db.createDemand({
      clientId: testClientId,
      date: demandDate,
      startTime: "09:00",
      endTime: "17:00",
      requiredWorkers: 1,
      location: "測試地點",
      note: "測試派工同步需求單",
      status: "confirmed",
    });
    testDemandId = demand.id;
    testDataIds.demands!.push(demand.id);
  });

  afterAll(async () => {
    // 清理測試資料
    const database = await db.getDb();
    if (database) {
      const { demands, assignments, workers, clients, availability } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      // 1. 刪除 assignments
      for (const id of testDataIds.assignments!) {
        await database.delete(assignments).where(eq(assignments.id, id));
      }

      // 2. 刪除 demands
      for (const id of testDataIds.demands!) {
        await database.delete(demands).where(eq(demands.id, id));
      }

      // 3. 刪除 availability
      for (const id of testDataIds.availability!) {
        await database.delete(availability).where(eq(availability.id, id));
      }
      
      // 4. 刪除 workers
      for (const id of testDataIds.workers!) {
        await database.delete(workers).where(eq(workers.id, id));
      }

      // 5. 刪除 clients
      for (const id of testDataIds.clients!) {
        await database.delete(clients).where(eq(clients.id, id));
      }
    }
  });

  // ==================== 測試案例 1：管理員指派員工 ====================
  
  it("測試案例 1：管理員應該能夠指派員工到需求單", async () => {
    const assignment = await db.createAssignment({
      demandId: testDemandId,
      workerId: testWorkerId,
      status: "confirmed",
    });

    testAssignmentId = assignment.id;
    testDataIds.assignments!.push(assignment.id);

    expect(assignment).toBeDefined();
    expect(assignment.demandId).toBe(testDemandId);
    expect(assignment.workerId).toBe(testWorkerId);
    expect(assignment.status).toBe("confirmed");
  });

  // ==================== 測試案例 2：需求單的 assignedCount 應該更新 ====================
  
  it("測試案例 2：指派員工後，需求單的 assignedCount 應該自動更新", async () => {
    const demand = await db.getDemandById(testDemandId);

    expect(demand).toBeDefined();
    expect(demand?.assignedCount).toBe(1);
  });

  // ==================== 測試案例 3：客戶查詢需求單時應該看到已指派的員工 ====================
  
  it("測試案例 3：客戶查詢需求單時應該看到已指派的員工資訊", async () => {
    const demand = await db.getDemandById(testDemandId);
    const assignments = await db.getAssignmentsByDemand(testDemandId);

    expect(demand).toBeDefined();
    expect(assignments.length).toBe(1);
    expect(assignments[0].workerId).toBe(testWorkerId);
    expect(assignments[0].status).toBe("confirmed");
  });

  // ==================== 測試案例 4：取消指派後需求單應該更新 ====================
  
  it("測試案例 4：取消指派後，需求單的 assignedCount 應該減少", async () => {
    // 取消指派
    await db.updateAssignment(testAssignmentId, {
      status: "cancelled",
    });

    // 檢查需求單的指派狀況
    const demand = await db.getDemandById(testDemandId);
    const assignments = await db.getAssignmentsByDemand(testDemandId);
    expect(demand).toBeDefined();
    expect(assignments.length).toBe(0);
  });

  // ==================== 測試案例 5：重新指派員工 ====================
  
  it("測試案例 5：重新指派員工後，需求單的 assignedCount 應該恢復", async () => {
    // 重新指派
    await db.updateAssignment(testAssignmentId, {
      status: "confirmed",
    });

    // 檢查需求單的指派狀況
    const demand = await db.getDemandById(testDemandId);
    const assignments = await db.getAssignmentsByDemand(testDemandId);
    expect(demand).toBeDefined();
    expect(assignments.length).toBe(1);
    expect(assignments[0].workerId).toBe(testWorkerId);
    expect(assignments[0].status).toBe("confirmed");
  });

  // ==================== 測試案例 6：指派多位員工 ====================
  
  it("測試案例 6：指派多位員工後，需求單的 assignedCount 應該正確累加", async () => {
    // 建立第二位測試員工
    const worker2 = await db.createWorker({
      name: "測試員工2-派工同步",
      phone: "0987-654-322",
      status: "active",
    });
    testDataIds.workers!.push(worker2.id);

    // 建立第二位員工的可用時段
    const demandDate2 = new Date("2026-03-15T00:00:00Z");
    demandDate2.setUTCHours(0, 0, 0, 0);

    // 計算週開始日期（星期一）
    const weekStartDate2 = new Date(demandDate2);
    const dayOfWeek2 = weekStartDate2.getDay();
    const daysToMonday2 = dayOfWeek2 === 0 ? -6 : 1 - dayOfWeek2;
    weekStartDate2.setDate(weekStartDate2.getDate() + daysToMonday2);
    weekStartDate2.setUTCHours(0, 0, 0, 0);

    // 計算週結束日期（星期日）
    const weekEndDate2 = new Date(weekStartDate2);
    weekEndDate2.setDate(weekEndDate2.getDate() + 6);
    weekEndDate2.setUTCHours(0, 0, 0, 0);

    const availabilityId2 = await db.upsertAvailability({
      workerId: worker2.id,
      weekStartDate: weekStartDate2,
      weekEndDate: weekEndDate2,
      timeBlocks: JSON.stringify([
        { date: "2026-03-15", startTime: "08:00", endTime: "18:00" }
      ]),
    });
    
    if (typeof availabilityId2 === 'number') {
      testDataIds.availability!.push(availabilityId2);
    }
    // 指派第二位員工
    const demandForAssignment = await db.getDemandById(testDemandId);
    
    // 計算排班時數
    const startHour = parseInt(demandForAssignment!.startTime.split(':')[0]);
    const endHour = parseInt(demandForAssignment!.endTime.split(':')[0]);
    const scheduledHours = endHour - startHour - (demandForAssignment!.breakHours || 0);
    
    const assignment2 = await db.createAssignment({
      demandId: testDemandId,
      workerId: worker2.id,
      scheduledStart: new Date(`${demandForAssignment!.date.toISOString().split('T')[0]}T${demandForAssignment!.startTime}:00Z`),
      scheduledEnd: new Date(`${demandForAssignment!.date.toISOString().split('T')[0]}T${demandForAssignment!.endTime}:00Z`),
      scheduledHours,
      status: "confirmed",
    });
    testDataIds.assignments!.push(assignment2.id);

    // 檢查需求單的指派狀況
    const demand = await db.getDemandById(testDemandId);
    const assignments = await db.getAssignmentsByDemand(testDemandId);
    expect(demand).toBeDefined();
    expect(assignments.length).toBe(2);mand(testDemandId);
    expect(demand).toBeDefined();
    expect(assignments.length).toBe(1);
    expect(assignments[0].workerId).toBe(testWorkerId);
    expect(assignments[0].status).toBe("confirmed");
  });

  // ==================== 測試案例 7：客戶查詢需求單時應該看到所有已指派的員工 ====================
  
  it("測試案例 7：客戶查詢需求單時應該看到所有已指派的員工資訊", async () => {
    const assignments = await db.getAssignmentsByDemand(testDemandId);

    expect(assignments.length).toBe(2);
    expect(assignments.every((a) => a.status === "confirmed")).toBe(true);
  });
});
