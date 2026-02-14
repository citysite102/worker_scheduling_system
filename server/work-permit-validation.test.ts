import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { cleanupAllTestData } from "./test-utils";

describe("簽證資料一致性驗證", () => {
  beforeEach(async () => {
    await cleanupAllTestData();
  });

  describe("workers.create", () => {
    it("應該允許：勾選有工作簽證 + 設定到期日", async () => {
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
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });
      
      const result = await caller.workers.create({
        name: "測試員工B",
        phone: "0912345679",
        hasWorkPermit: true,
        // 不設定 workPermitExpiryDate
      });

      expect(result.success).toBe(true);
    });

    it("應該允許：未勾選有工作簽證 + 不設定到期日", async () => {
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });
      
      const result = await caller.workers.create({
        name: "測試員工C",
        phone: "0912345680",
        hasWorkPermit: false,
        // 不設定 workPermitExpiryDate
      });

      expect(result.success).toBe(true);
    });

    it("應該拒絕：未勾選有工作簽證 + 設定到期日（資料不一致）", async () => {
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
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });
      
      // 先建立員工
      await caller.workers.create({
        name: "測試員工E",
        phone: "0912345682",
        hasWorkPermit: false,
      });

      const workers = await caller.workers.list({ search: "測試員工E" });
      const workerId = workers[0].id;

      // 更新為有工作簽證 + 設定到期日
      const result = await caller.workers.update({
        id: workerId,
        hasWorkPermit: true,
        workPermitExpiryDate: new Date("2026-12-31"),
      });

      expect(result.success).toBe(true);
    });

    it("應該拒絕：更新為無工作簽證 + 設定到期日（資料不一致）", async () => {
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });
      
      // 先建立員工
      await caller.workers.create({
        name: "測試員工F",
        phone: "0912345683",
        hasWorkPermit: true,
        workPermitExpiryDate: new Date("2026-12-31"),
      });

      const workers = await caller.workers.list({ search: "測試員工F" });
      const workerId = workers[0].id;

      // 更新為無工作簽證但保留到期日（應該被拒絕）
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

      expect(result.successCount).toBe(1); // 第一筆成功
      expect(result.failureCount).toBe(1); // 第二筆失敗
      expect(result.results[1].error).toContain("資料不一致");
    });
  });
});
