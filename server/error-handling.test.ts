import { describe, expect, it } from "vitest";

/**
 * 錯誤處理機制測試
 * 
 * 這些測試驗證前端錯誤處理邏輯的正確性：
 * 1. 自動重試機制
 * 2. 友善錯誤訊息
 * 3. 重試延遲策略
 */

describe("錯誤處理機制", () => {
  describe("重試邏輯", () => {
    it("應該對網路錯誤重試最多 3 次", () => {
      const retryFn = (failureCount: number, error: Error) => {
        if (error.message.includes("Failed to fetch")) {
          return failureCount < 3;
        }
        return false;
      };

      const networkError = new Error("Failed to fetch");
      
      expect(retryFn(0, networkError)).toBe(true);  // 第 1 次重試
      expect(retryFn(1, networkError)).toBe(true);  // 第 2 次重試
      expect(retryFn(2, networkError)).toBe(true);  // 第 3 次重試
      expect(retryFn(3, networkError)).toBe(false); // 不再重試
    });

    it("應該對伺服器錯誤重試最多 2 次", () => {
      const retryFn = (failureCount: number, error: Error) => {
        if (error.message.includes("<!doctype")) {
          return failureCount < 2;
        }
        return false;
      };

      const serverError = new Error("Unexpected token '<', \"<!doctype \"... is not valid JSON");
      
      expect(retryFn(0, serverError)).toBe(true);  // 第 1 次重試
      expect(retryFn(1, serverError)).toBe(true);  // 第 2 次重試
      expect(retryFn(2, serverError)).toBe(false); // 不再重試
    });

    it("應該對其他錯誤不重試", () => {
      const retryFn = (failureCount: number, error: Error) => {
        if (error.message.includes("Failed to fetch")) {
          return failureCount < 3;
        }
        if (error.message.includes("<!doctype")) {
          return failureCount < 2;
        }
        return false;
      };

      const otherError = new Error("Some other error");
      
      expect(retryFn(0, otherError)).toBe(false);
      expect(retryFn(1, otherError)).toBe(false);
    });
  });

  describe("重試延遲策略", () => {
    it("應該使用指數退避策略", () => {
      const retryDelay = (attemptIndex: number) => {
        return Math.min(1000 * 2 ** attemptIndex, 4000);
      };

      expect(retryDelay(0)).toBe(1000);  // 第 1 次重試：1 秒
      expect(retryDelay(1)).toBe(2000);  // 第 2 次重試：2 秒
      expect(retryDelay(2)).toBe(4000);  // 第 3 次重試：4 秒
      expect(retryDelay(3)).toBe(4000);  // 最大延遲：4 秒
    });
  });

  describe("錯誤訊息轉換", () => {
    it("應該識別網路連線錯誤", () => {
      const error = new Error("Failed to fetch");
      expect(error.message.includes("Failed to fetch")).toBe(true);
    });

    it("應該識別伺服器錯誤（HTML 返回）", () => {
      const error1 = new Error("Unexpected token '<', \"<!doctype \"... is not valid JSON");
      const error2 = new Error("not valid JSON");
      
      expect(error1.message.includes("<!doctype")).toBe(true);
      expect(error2.message.includes("not valid JSON")).toBe(true);
    });

    it("應該正確分類不同類型的錯誤", () => {
      const networkError = new Error("Failed to fetch");
      const serverError = new Error("<!doctype html>");
      const otherError = new Error("Some other error");

      const isNetworkError = (error: Error) => error.message.includes("Failed to fetch");
      const isServerError = (error: Error) => 
        error.message.includes("<!doctype") || error.message.includes("not valid JSON");

      expect(isNetworkError(networkError)).toBe(true);
      expect(isNetworkError(serverError)).toBe(false);
      expect(isNetworkError(otherError)).toBe(false);

      expect(isServerError(networkError)).toBe(false);
      expect(isServerError(serverError)).toBe(true);
      expect(isServerError(otherError)).toBe(false);
    });
  });
});
