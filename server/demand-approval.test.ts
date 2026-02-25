import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import * as db from "./db";

describe("需求單審核功能", () => {
  let testClientId: number;
  let testDemandId: number;
  let adminContext: any;
  let nonAdminContext: any;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("無法連接資料庫");

    // 建立測試客戶
    const clientResult = await db.execute(sql`
      INSERT INTO clients (clientCode, name, contactName, contactPhone, status)
      VALUES ('TEST-APPROVAL-001', '測試審核客戶', '測試聯絡人', '0912345678', 'active')
    `);
    testClientId = Number((clientResult as any)[0].insertId);

    // 建立測試需求單（pending 狀態）
    const demandResult = await db.execute(sql`
      INSERT INTO demands (clientId, date, startTime, endTime, requiredWorkers, status)
      VALUES (${sql.raw(String(testClientId))}, NOW(), '09:00', '17:00', 2, 'pending')
    `);
    testDemandId = Number((demandResult as any)[0].insertId);

    // 建立測試 context
    adminContext = {
      user: {
        id: 1,
        openId: "test-admin",
        name: "測試管理員",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
    };

    nonAdminContext = {
      user: {
        id: 2,
        openId: "test-user",
        name: "測試使用者",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
    };
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // 清理測試資料
    if (testDemandId) {
      await db.execute(sql`DELETE FROM demands WHERE id = ${sql.raw(String(testDemandId))}`);
    }
    if (testClientId) {
      await db.execute(sql`DELETE FROM clients WHERE id = ${sql.raw(String(testClientId))}`);
    }
  });

  it("管理員可以審核通過需求單", async () => {
    const caller = appRouter.createCaller(adminContext);
    const result = await caller.demands.approve({ id: testDemandId });

    expect(result.success).toBe(true);

    // 驗證狀態已更新為 confirmed
    const db = await getDb();
    if (!db) throw new Error("無法連接資料庫");

    const demand = await db.execute(sql`
      SELECT status FROM demands WHERE id = ${sql.raw(String(testDemandId))}
    `);
    expect((demand as any)[0][0].status).toBe("confirmed");

    // 恢復為 pending 狀態以便後續測試
    await db.execute(sql`
      UPDATE demands SET status = 'pending' WHERE id = ${sql.raw(String(testDemandId))}
    `);
  });

  it("非管理員無法審核需求單", async () => {
    const caller = appRouter.createCaller(nonAdminContext);

    await expect(
      caller.demands.approve({ id: testDemandId })
    ).rejects.toThrow("只有管理員可以審核需求單");
  });

  it("管理員可以拒絕需求單", async () => {
    const caller = appRouter.createCaller(adminContext);
    const result = await caller.demands.reject({
      id: testDemandId,
      reason: "測試拒絕原因",
    });

    expect(result.success).toBe(true);

    // 驗證狀態已更新為 cancelled
    const db = await getDb();
    if (!db) throw new Error("無法連接資料庫");

    const demand = await db.execute(sql`
      SELECT status, note FROM demands WHERE id = ${sql.raw(String(testDemandId))}
    `);
    expect((demand as any)[0][0].status).toBe("cancelled");
    expect((demand as any)[0][0].note).toContain("審核拒絕：測試拒絕原因");
  });

  it("只能審核 pending 狀態的需求單", async () => {
    const db = await getDb();
    if (!db) throw new Error("無法連接資料庫");

    // 建立一個 confirmed 狀態的需求單
    const demandResult = await db.execute(sql`
      INSERT INTO demands (clientId, date, startTime, endTime, requiredWorkers, status)
      VALUES (${sql.raw(String(testClientId))}, NOW(), '09:00', '17:00', 2, 'confirmed')
    `);
    const confirmedDemandId = Number((demandResult as any)[0].insertId);

    const caller = appRouter.createCaller(adminContext);

    await expect(
      caller.demands.approve({ id: confirmedDemandId })
    ).rejects.toThrow("只有待審核的需求單才可以審核");

    // 清理測試資料
    await db.execute(sql`DELETE FROM demands WHERE id = ${sql.raw(String(confirmedDemandId))}`);
  });
});
