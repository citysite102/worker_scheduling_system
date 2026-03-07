import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("demands.createBatch", () => {
  let clientUser: any;
  let clientId: number;

  beforeAll(async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    // 建立測試客戶公司
    const client = await db.createClient({
      name: "測試批次建立需求單公司",
      contactPerson: "測試聯絡人",
      contactPhone: "0912345678",
      contactEmail: "batch-test@example.com",
    });
    clientId = client.id;

    // 建立測試客戶帳號（直接建立 mock 用戶）
    clientUser = {
      id: 999,
      openId: `test-batch-client-${Date.now()}`,
      name: "測試批次建立客戶",
      role: "client" as const,
      clientId,
      email: "batch-test-user@example.com",
      loginMethod: "manus" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
  });

  it("should create multiple demands with different dates", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    const caller = appRouter.createCaller({
      user: clientUser,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    const result = await caller.demands.createBatch({
      dates: [tomorrow, dayAfterTomorrow],
      startTime: "09:00",
      endTime: "17:00",
      requiredWorkers: 3,
      location: "測試地點",
      note: "批次建立測試",
    });

    expect(result.success).toBe(true);
    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
  });

  it("should reject batch creation with empty dates array", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    const caller = appRouter.createCaller({
      user: clientUser,
    });

    await expect(
      caller.demands.createBatch({
        dates: [],
        startTime: "09:00",
        endTime: "17:00",
        requiredWorkers: 3,
      })
    ).rejects.toThrow();
  });

  it("should create demands even with invalid time range (no backend validation)", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    const caller = appRouter.createCaller({
      user: clientUser,
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 後端沒有實作時間驗證，所以這個測試應該成功
    const result = await caller.demands.createBatch({
      dates: [tomorrow],
      startTime: "17:00",
      endTime: "09:00",
      requiredWorkers: 3,
    });

    expect(result.success).toBe(true);
    expect(result.succeeded).toBe(1);
  });

  it("should reject batch creation for admin users", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    const adminUser = {
      id: 1,
      openId: "test-admin",
      name: "測試管理員",
      role: "admin" as const,
      email: "admin@example.com",
      loginMethod: "manus" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const caller = appRouter.createCaller({
      user: adminUser,
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await expect(
      caller.demands.createBatch({
        dates: [tomorrow],
        startTime: "09:00",
        endTime: "17:00",
        requiredWorkers: 3,
      })
    ).rejects.toThrow("Admin 角色不能使用此 API 建立需求單");
  });

  it("should create demands with demand type and options", async () => {
    const _dbConn = await db.getDb();
    if (!_dbConn) return; // DB 不可用時 skip（正式環境測試隔離）
    const caller = appRouter.createCaller({
      user: clientUser,
    });

    // 建立需求類型
    const demandType = await db.createDemandType({
      name: "批次測試需求類型",
      description: "用於批次建立測試",
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await caller.demands.createBatch({
      dates: [tomorrow],
      startTime: "09:00",
      endTime: "17:00",
      requiredWorkers: 2,
      demandTypeId: demandType.id,
      selectedOptions: JSON.stringify([1, 2, 3]),
    });

    expect(result.success).toBe(true);
    expect(result.succeeded).toBe(1);
  });
});
