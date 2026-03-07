import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

describe("需求單批次審核功能", () => {
  let testClientId: number;
  let testDemandIds: number[] = [];
  let adminContext: any;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) return; // DB 不可用時 skip（正式環境測試隔離）

    // 建立測試客戶
    const clientResult = await db.execute(sql`
      INSERT INTO clients (clientCode, name, contactName, contactPhone, status)
      VALUES ('TEST-BATCH-001', '測試批次審核客戶', '測試聯絡人', '0912345678', 'active')
    `);
    testClientId = Number((clientResult as any)[0].insertId);

    // 建立 3 個測試需求單（pending 狀態）
    for (let i = 1; i <= 3; i++) {
      const demandResult = await db.execute(sql`
        INSERT INTO demands (clientId, date, startTime, endTime, requiredWorkers, status)
        VALUES (${sql.raw(String(testClientId))}, NOW(), '09:00', '17:00', 2, 'pending')
      `);
      testDemandIds.push(Number((demandResult as any)[0].insertId));
    }

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
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // 清理測試資料
    for (const id of testDemandIds) {
      await db.execute(sql`DELETE FROM demands WHERE id = ${sql.raw(String(id))}`);
    }
    if (testClientId) {
      await db.execute(sql`DELETE FROM clients WHERE id = ${sql.raw(String(testClientId))}`);
    }
  });

  it("可以批次審核通過多筆需求單", async () => {
    const db = await getDb();
    if (!db) return; // DB 不可用時 skip（正式環境測試隔離）
    const caller = appRouter.createCaller(adminContext);
    const result = await caller.demands.batchApprove({ ids: testDemandIds });

    expect(result.success.length).toBe(3);
    expect(result.failed.length).toBe(0);

    // 驗證所有需求單狀態都已更新為 confirmed
    for (const id of testDemandIds) {
      const demand = await db.execute(sql`
        SELECT status FROM demands WHERE id = ${sql.raw(String(id))}
      `);
      expect((demand as any)[0][0].status).toBe("confirmed");
    }

    // 恢復為 pending 狀態以便後續測試
    for (const id of testDemandIds) {
      await db.execute(sql`
        UPDATE demands SET status = 'pending' WHERE id = ${sql.raw(String(id))}
      `);
    }
  });

  it("可以批次拒絕多筆需求單", async () => {
    const db = await getDb();
    if (!db) return; // DB 不可用時 skip（正式環境測試隔離）
    const caller = appRouter.createCaller(adminContext);
    const result = await caller.demands.batchReject({ 
      ids: testDemandIds, 
      reason: "測試批次拒絕" 
    });

    expect(result.success.length).toBe(3);
    expect(result.failed.length).toBe(0);

    // 驗證所有需求單狀態都已更新為 cancelled
    for (const id of testDemandIds) {
      const demand = await db.execute(sql`
        SELECT status, note FROM demands WHERE id = ${sql.raw(String(id))}
      `);
      expect((demand as any)[0][0].status).toBe("cancelled");
      expect((demand as any)[0][0].note).toContain("審核拒絕：測試批次拒絕");
    }
  });

  it("批次審核時會跳過非 pending 狀態的需求單", async () => {
    const db = await getDb();
    if (!db) return; // DB 不可用時 skip（正式環境測試隔離）

    // 建立一個 confirmed 狀態的需求單
    const demandResult = await db.execute(sql`
      INSERT INTO demands (clientId, date, startTime, endTime, requiredWorkers, status)
      VALUES (${sql.raw(String(testClientId))}, NOW(), '09:00', '17:00', 2, 'confirmed')
    `);
    const confirmedDemandId = Number((demandResult as any)[0].insertId);

    // 建立一個 pending 狀態的需求單
    const pendingDemandResult = await db.execute(sql`
      INSERT INTO demands (clientId, date, startTime, endTime, requiredWorkers, status)
      VALUES (${sql.raw(String(testClientId))}, NOW(), '09:00', '17:00', 2, 'pending')
    `);
    const pendingDemandId = Number((pendingDemandResult as any)[0].insertId);

    const caller = appRouter.createCaller(adminContext);
    const result = await caller.demands.batchApprove({ 
      ids: [confirmedDemandId, pendingDemandId] 
    });

    // 應該只有一筆成功（pending 的那筆）
    expect(result.success.length).toBe(1);
    expect(result.success[0]).toBe(pendingDemandId);
    
    // 應該有一筆失敗（confirmed 的那筆）
    expect(result.failed.length).toBe(1);
    expect(result.failed[0].id).toBe(confirmedDemandId);
    expect(result.failed[0].reason).toContain("只有待審核的需求單才可以審核");

    // 清理測試資料
    await db.execute(sql`DELETE FROM demands WHERE id = ${sql.raw(String(confirmedDemandId))}`);
    await db.execute(sql`DELETE FROM demands WHERE id = ${sql.raw(String(pendingDemandId))}`);
  });

  it("批次審核時需要至少選擇一筆需求單", async () => {
    const db = await getDb();
    if (!db) return; // DB 不可用時 skip（正式環境測試隔離）
    const caller = appRouter.createCaller(adminContext);

    await expect(
      caller.demands.batchApprove({ ids: [] })
    ).rejects.toThrow("請至少選擇一筆需求單");
  });
});
