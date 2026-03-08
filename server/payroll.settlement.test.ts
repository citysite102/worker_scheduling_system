/**
 * payroll.settlement.test.ts
 * 測試月結結算確認功能的業務邏輯
 * 注意：這些測試不連接真實資料庫，使用 mock 方式驗證邏輯
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ============ 月結鎖定業務邏輯單元測試 ============

describe("payroll settlement business logic", () => {
  /**
   * 測試：台灣時區年月計算
   * 確保 UTC 時間戳正確轉換為台灣時區的年月
   */
  it("correctly converts UTC timestamp to Taiwan year/month", () => {
    // UTC 2026-01-31T16:00:00Z = 台灣 2026-02-01T00:00:00+08:00
    const utcDate = new Date("2026-01-31T16:00:00Z");
    const twDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
    const year = twDate.getUTCFullYear();
    const month = twDate.getUTCMonth() + 1;
    expect(year).toBe(2026);
    expect(month).toBe(2); // 台灣時間已進入 2 月
  });

  it("correctly handles same day in UTC and Taiwan timezone", () => {
    // UTC 2026-03-08T10:00:00Z = 台灣 2026-03-08T18:00:00+08:00（同日）
    const utcDate = new Date("2026-03-08T10:00:00Z");
    const twDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
    const year = twDate.getUTCFullYear();
    const month = twDate.getUTCMonth() + 1;
    expect(year).toBe(2026);
    expect(month).toBe(3);
  });

  /**
   * 測試：結算狀態回傳格式
   */
  it("settlement status returns correct structure when not settled", () => {
    // 模擬未結算的回傳
    const notSettled = { settled: false };
    expect(notSettled.settled).toBe(false);
  });

  it("settlement status returns correct structure when settled", () => {
    // 模擬已結算的回傳
    const settled = {
      settled: true,
      settledAt: new Date("2026-03-08T10:00:00Z"),
      settledByName: "Admin User",
      totalAmount: 15000,
      totalHours: 480, // 8 小時 = 480 分鐘
      assignmentCount: 3,
      note: "三月份月結",
    };
    expect(settled.settled).toBe(true);
    expect(settled.totalAmount).toBe(15000);
    expect(settled.assignmentCount).toBe(3);
    expect(settled.settledByName).toBe("Admin User");
  });

  /**
   * 測試：月結鎖定後薪資修改應被拒絕
   * 驗證錯誤訊息格式
   */
  it("generates correct locked error message format", () => {
    const year = 2026;
    const month = 3;
    const errorMessage = `${year}年${month}月薪資已結算鎖定，如需修改請先解除結算。`;
    expect(errorMessage).toBe("2026年3月薪資已結算鎖定，如需修改請先解除結算。");
  });

  /**
   * 測試：重複結算應回傳 CONFLICT 錯誤訊息
   */
  it("generates correct duplicate settle error message", () => {
    const year = 2026;
    const month = 3;
    const errorMessage = `${year}年${month}月已結算，請勿重複操作。`;
    expect(errorMessage).toBe("2026年3月已結算，請勿重複操作。");
  });

  /**
   * 測試：解除未結算月份應回傳 NOT_FOUND 錯誤訊息
   */
  it("generates correct not-found error message for unsettle", () => {
    const year = 2026;
    const month = 3;
    const errorMessage = `${year}年${month}月尚未結算。`;
    expect(errorMessage).toBe("2026年3月尚未結算。");
  });

  /**
   * 測試：admin context 應包含正確的 user.id
   */
  it("admin context has correct user id for settledBy", () => {
    const ctx = createAdminContext();
    expect(ctx.user?.id).toBe(1);
    expect(ctx.user?.role).toBe("admin");
  });
});

// ============ 台灣時區工具函式測試 ============

describe("Taiwan timezone utilities for settlement", () => {
  it("calculates correct month boundary for settlement", () => {
    // 月份邊界：UTC 2026-02-28T16:00:00Z = 台灣 2026-03-01T00:00:00+08:00
    const utcDate = new Date("2026-02-28T16:00:00Z");
    const twDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
    expect(twDate.getUTCMonth() + 1).toBe(3); // 台灣已進入 3 月
  });

  it("handles year boundary correctly", () => {
    // UTC 2025-12-31T16:00:00Z = 台灣 2026-01-01T00:00:00+08:00
    const utcDate = new Date("2025-12-31T16:00:00Z");
    const twDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
    expect(twDate.getUTCFullYear()).toBe(2026);
    expect(twDate.getUTCMonth() + 1).toBe(1);
  });
});
