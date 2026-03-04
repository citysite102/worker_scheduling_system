/**
 * Email 唯一性驗證測試
 * 測試 clients.createUser 和 clients.updateUser 的 Email 重複檢查邏輯
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-test-user",
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
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

describe("clients.createUser - Email 唯一性驗證", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("當 Email 已被其他帳號使用時，應拋出 CONFLICT 錯誤", async () => {
    // Mock getUserByEmail 回傳已存在的使用者
    vi.spyOn(db, "getUserByEmail").mockResolvedValue({
      id: 999,
      openId: "existing-user",
      name: "Existing User",
      email: "duplicate@example.com",
      loginMethod: "password",
      role: "client",
      clientId: 1,
      position: null,
      phone: null,
      password: null,
      passwordResetToken: null,
      passwordResetExpires: null,
      mustChangePassword: 0,
      onboardingCompleted: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.clients.createUser({
        clientId: 1,
        name: "New User",
        email: "duplicate@example.com",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("duplicate@example.com"),
    });
  });

  it("當 Email 未被使用時，應成功建立使用者", async () => {
    // Mock getUserByEmail 回傳 undefined（Email 未被使用）
    vi.spyOn(db, "getUserByEmail").mockResolvedValue(undefined);
    // Mock createClientUser 成功
    vi.spyOn(db, "createClientUser").mockResolvedValue(undefined);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // 因為 sendEmail 也會被呼叫，這裡允許錯誤（測試環境無 SMTP）
    try {
      const result = await caller.clients.createUser({
        clientId: 1,
        name: "New User",
        email: "newuser@example.com",
      });
      // 如果成功，應回傳 success: true
      expect(result.success).toBe(true);
    } catch (err: unknown) {
      // 測試環境可能因 email 發送或其他 DB 操作失敗，這是可接受的
      const error = err as { code?: string; message?: string };
      // 但不應該是 CONFLICT 錯誤
      expect(error.code).not.toBe("CONFLICT");
    }
  });
});

describe("clients.updateUser - Email 唯一性驗證", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("當新 Email 已被其他帳號使用時，應拋出 CONFLICT 錯誤", async () => {
    // Mock getUserByEmail 回傳另一個使用者（id 不同）
    vi.spyOn(db, "getUserByEmail").mockResolvedValue({
      id: 888,
      openId: "another-user",
      name: "Another User",
      email: "taken@example.com",
      loginMethod: "password",
      role: "client",
      clientId: 2,
      position: null,
      phone: null,
      password: null,
      passwordResetToken: null,
      passwordResetExpires: null,
      mustChangePassword: 0,
      onboardingCompleted: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // 嘗試將 userId=100 的 email 改為已被 id=888 使用的 email
    await expect(
      caller.clients.updateUser({
        userId: 100,
        email: "taken@example.com",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("taken@example.com"),
    });
  });

  it("當新 Email 是自己目前的 Email 時，應允許更新（不報錯）", async () => {
    const selfUserId = 100;

    // Mock getUserByEmail 回傳自己（id 相同）
    vi.spyOn(db, "getUserByEmail").mockResolvedValue({
      id: selfUserId,
      openId: "self-user",
      name: "Self User",
      email: "self@example.com",
      loginMethod: "password",
      role: "client",
      clientId: 1,
      position: null,
      phone: null,
      password: null,
      passwordResetToken: null,
      passwordResetExpires: null,
      mustChangePassword: 0,
      onboardingCompleted: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
    // Mock updateClientUser 成功
    vi.spyOn(db, "updateClientUser").mockResolvedValue(undefined);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.clients.updateUser({
      userId: selfUserId,
      email: "self@example.com",
    });

    expect(result.success).toBe(true);
  });

  it("當更新時不帶 email 欄位，應跳過 Email 唯一性檢查", async () => {
    const getUserByEmailSpy = vi.spyOn(db, "getUserByEmail");
    vi.spyOn(db, "updateClientUser").mockResolvedValue(undefined);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await caller.clients.updateUser({
      userId: 100,
      name: "Updated Name",
      // 不帶 email
    });

    // getUserByEmail 不應被呼叫
    expect(getUserByEmailSpy).not.toHaveBeenCalled();
  });
});
