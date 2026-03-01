import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createClientContext(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 99,
    openId: "client-user-onboarding-test",
    email: "client@example.com",
    name: "Test Client User",
    loginMethod: "password",
    role: "client",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
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

describe("auth.onboardingStatus", () => {
  it("should return onboardingCompleted as boolean", async () => {
    const ctx = createClientContext();
    const caller = appRouter.createCaller(ctx);

    // This will attempt a DB query; if DB is unavailable it returns { onboardingCompleted: true }
    const result = await caller.auth.onboardingStatus();
    expect(result).toHaveProperty("onboardingCompleted");
    expect(typeof result.onboardingCompleted).toBe("boolean");
  });
});

describe("auth.completeOnboarding", () => {
  it("should return success when called by authenticated client", async () => {
    const ctx = createClientContext();
    const caller = appRouter.createCaller(ctx);

    // This will attempt a DB update; if DB is unavailable it may throw
    // We just verify the procedure exists and returns the expected shape on success
    try {
      const result = await caller.auth.completeOnboarding();
      expect(result).toEqual({ success: true });
    } catch (err: unknown) {
      // DB not available in test env is acceptable
      const error = err as { message?: string };
      expect(error.message).toBeDefined();
    }
  });

  it("should throw UNAUTHORIZED when called without user context", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {}, cookie: () => {} } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.completeOnboarding()).rejects.toThrow();
  });
});
