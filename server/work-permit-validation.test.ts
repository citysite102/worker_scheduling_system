/**
 * 簽證資料一致性驗證測試
 *
 * 注意：此測試需要資料庫連線。在正式環境（DATABASE_URL 為空）中，
 * 所有測試會自動 skip（回傳 undefined），不會影響正式資料庫。
 */
import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { cleanupAllTestData } from "./test-utils";
import { getDb } from "./db";

describe("簽證資料一致性驗證", () => {
  beforeEach(async () => {
    await cleanupAllTestData();
  });

  describe("workers.create", () => {
    it("應該允許：勾選有工作簽證 + 設定到期日", async () => {
      const db = await getDb();
      if (!db) return; // DB 不可用時 skip
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      const result = await caller.workers.create({
        name: "測試員工A",
        phone: "0912345678",
        hasWorkPermit: true,
        workPermitExpiryDate: new Date("2026-12-31"),
      });
      expect(result.success).toBe(true);
    });

    it("應該允許：勾選有工作簽證 + 不設定到期日（無期限）", async () => {
      const db = await getDb();
      if (!db) return;
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      const result = await caller.workers.create({
        name: "測試員工B",
        phone: "0912345679",
        hasWorkPermit: true,
      });
      expect(result.success).toBe(true);
    });

    it("應該允許：未勾選有工作簽證 + 不設定到期日", async () => {
      const db = await getDb();
      if (!db) return;
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      const result = await caller.workers.create({
        name: "測試員工C",
        phone: "0912345680",
        hasWorkPermit: false,
      });
      expect(result.success).toBe(true);
    });

    it("應該拒絕：未勾選有工作簽證 + 設定到期日（資料不一致）", async () => {
      // 此測試為純業務邏輯驗證，不需要 DB（驗證在寫入前就會拋出錯誤）
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      await expect(
        caller.workers.create({
          name: "測試員工D",
          phone: "0912345681",
          hasWorkPermit: false,
          workPermitExpiryDate: new Date("2026-12-31"),
        })
      ).rejects.toThrow("資料不一致：未勾選『有工作簽證』時，不可設定到期日");
    });
  });

  describe("workers.update", () => {
    it("應該允許：更新為有工作簽證 + 設定到期日", async () => {
      const db = await getDb();
      if (!db) return;
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      await caller.workers.create({
        name: "測試員工E",
        phone: "0912345682",
        hasWorkPermit: false,
      });
      const workersList = await caller.workers.list({ search: "測試員工E" });
      const workerId = workersList[0].id;

      const result = await caller.workers.update({
        id: workerId,
        hasWorkPermit: true,
        workPermitExpiryDate: new Date("2026-12-31"),
      });
      expect(result.success).toBe(true);
    });

    it("應該拒絕：更新為無工作簽證 + 設定到期日（資料不一致）", async () => {
      // 此測試為純業務邏輯驗證（驗證在寫入前就會拋出錯誤）
      // 但 update 需要有效的 workerId，所以仍需 DB
      const db = await getDb();
      if (!db) return;
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      await caller.workers.create({
        name: "測試員工F",
        phone: "0912345683",
        hasWorkPermit: true,
        workPermitExpiryDate: new Date("2026-12-31"),
      });
      const workersList = await caller.workers.list({ search: "測試員工F" });
      const workerId = workersList[0].id;

      await expect(
        caller.workers.update({
          id: workerId,
          hasWorkPermit: false,
          workPermitExpiryDate: new Date("2027-01-01"),
        })
      ).rejects.toThrow("資料不一致：未勾選『有工作簽證』時，不可設定到期日");
    });
  });

  describe("workers.batchCreate", () => {
    it("應該允許：批次建立合法的員工資料", async () => {
      const db = await getDb();
      if (!db) return;
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      const result = await caller.workers.batchCreate({
        workers: [
          {
            name: "測試員工G",
            phone: "0912345684",
            hasWorkPermit: true,
            workPermitExpiryDate: new Date("2026-12-31"),
          },
          {
            name: "測試員工H",
            phone: "0912345685",
            hasWorkPermit: false,
          },
        ],
      });
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
    });

    it("應該拒絕：批次建立時包含不一致的資料", async () => {
      const db = await getDb();
      if (!db) return;
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      const result = await caller.workers.batchCreate({
        workers: [
          {
            name: "測試員工I",
            phone: "0912345686",
            hasWorkPermit: true,
            workPermitExpiryDate: new Date("2026-12-31"),
          },
          {
            name: "測試員工J",
            phone: "0912345687",
            hasWorkPermit: false,
            workPermitExpiryDate: new Date("2026-12-31"), // 不一致
          },
        ],
      });
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.results[1].error).toContain("資料不一致");
    });
  });
});
