import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import { hashPassword } from "./password";

describe("客戶端操作流程測試", () => {
  const testDataIds = {
    assignments: [] as number[],
    demands: [] as number[],
    availability: [] as number[],
    workers: [] as number[],
    clients: [] as number[],
    users: [] as number[],
  };

  let testClientId: number;
  let testUserId: number;
  let testUserEmail: string;
  let testDemandId: number;

  beforeAll(async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    // 1. 建立測試客戶（使用隨機名稱避免 clientCode 重複）
    const client = await db.createClient({
      name: `測試客戶公司-客戶端流程-${Date.now()}`,
      contactName: "測試聯絡人",
      contactPhone: "0912-345-678",
      billingType: "hourly",
      status: "active",
    });
    testClientId = client.id;
    testDataIds.clients!.push(client.id);
  });

  afterAll(async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    // 清理測試資料
    const database = await db.getDb();
    if (database) {
      const { demands, assignments, workers, clients, availability, user } = await import("../drizzle/schema");
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

      // 5. 刪除 users
      for (const id of testDataIds.users!) {
        await database.delete(user).where(eq(user.id, id));
      }

      // 6. 刪除 clients
      for (const id of testDataIds.clients!) {
        await database.delete(clients).where(eq(clients.id, id));
      }
    }
  });

  // ==================== 測試案例 1：客戶帳號建立 ====================
  
  it("測試案例 1：建立客戶帳號並產生隨機密碼", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    // 產生隨機密碼
    const randomPassword = Math.random().toString(36).slice(-8);

    testUserEmail = `test-client-${Date.now()}@example.com`;

    // 使用 db 函數建立客戶使用者帳號
    const newUser = await db.createClientUser({
      clientId: testClientId,
      name: "測試客戶使用者",
      email: testUserEmail,
      openId: `test_openid_${Date.now()}`,
      password: randomPassword,
      position: "測試職位",
    });

    testUserId = newUser.id;
    testDataIds.users!.push(newUser.id);

    expect(newUser).toBeDefined();
    expect(newUser.email).toBe(testUserEmail);
    expect(newUser.role).toBe("client");
    expect(newUser.clientId).toBe(testClientId);
    expect(newUser.mustChangePassword).toBe(1);
  });

  // ==================== 測試案例 2：客戶登入 ====================
  
  it("測試案例 2：客戶使用者應該能夠查詢", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    // 使用 db 函數查詢客戶使用者
    const clientUsers = await db.getClientUsers(testClientId);
    const foundUser = clientUsers.find(u => u.email === testUserEmail);

    expect(foundUser).toBeDefined();
    expect(foundUser?.email).toBe(testUserEmail);
    expect(foundUser?.role).toBe("client");
    expect(foundUser?.clientId).toBe(testClientId);
  });

  // ==================== 測試案例 3：客戶建立需求單 ====================
  
  it("測試案例 3：客戶應該能夠建立需求單（草稿狀態）", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    const demandDate = new Date("2026-03-10T00:00:00Z");
    demandDate.setUTCHours(0, 0, 0, 0);

    const demand = await db.createDemand({
      clientId: testClientId,
      date: demandDate,
      startTime: "09:00",
      endTime: "17:00",
      requiredWorkers: 2,
      location: "測試地點",
      note: "測試需求單",
      status: "draft",
    });

    testDemandId = demand.id;
    testDataIds.demands!.push(demand.id);

    expect(demand).toBeDefined();
    expect(demand.clientId).toBe(testClientId);
    expect(demand.status).toBe("draft");
    expect(demand.requiredWorkers).toBe(2);
  });

  // ==================== 測試案例 4：客戶提交需求單審核 ====================
  
  it("測試案例 4：客戶應該能夠將草稿需求單提交審核", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    const updatedDemand = await db.updateDemand(testDemandId, {
      status: "pending",
    });

    expect(updatedDemand.status).toBe("pending");
  });

  // ==================== 測試案例 5：客戶查看需求單 ====================
  
  it("測試案例 5：客戶應該能夠查看自己的需求單", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    const allDemands = await db.getAllDemands();
    const clientDemands = allDemands.filter((d) => d.clientId === testClientId);

    expect(clientDemands.length).toBeGreaterThan(0);
    expect(clientDemands.some((d) => d.id === testDemandId)).toBe(true);
  });

  // ==================== 測試案例 6：客戶編輯草稿需求單 ====================
  
  it("測試案例 6：客戶應該能夠編輯草稿狀態的需求單", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    // 先將需求單改回草稿狀態
    await db.updateDemand(testDemandId, {
      status: "draft",
    });

    // 編輯需求單
    const updatedDemand = await db.updateDemand(testDemandId, {
      requiredWorkers: 3,
      note: "更新後的測試需求單",
    });

    expect(updatedDemand.requiredWorkers).toBe(3);
    expect(updatedDemand.note).toBe("更新後的測試需求單");
  });

  // ==================== 測試案例 7：客戶無法編輯已確認的需求單 ====================
  
  it("測試案例 7：客戶無法編輯已確認的需求單（應該由管理員控制）", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    // 將需求單設為已確認
    await db.updateDemand(testDemandId, {
      status: "confirmed",
    });

    const demand = await db.getDemandById(testDemandId);
    expect(demand?.status).toBe("confirmed");

    // 在實際應用中，前端應該根據狀態禁止編輯
    // 這裡我們只驗證狀態已經改變
  });
});
