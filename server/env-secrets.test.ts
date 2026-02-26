import { describe, it, expect } from "vitest";
import nodemailer from "nodemailer";

/**
 * 驗證 Gemini API Key 與 SMTP Email 環境變數是否已正確設定
 * 這些測試只驗證環境變數存在且格式正確，不實際呼叫外部 API
 */
describe("環境變數設定驗證", () => {
  describe("Gemini API Key", () => {
    it("GEMINI_API_KEY 應已設定且不為空", () => {
      const key = process.env.GEMINI_API_KEY;
      expect(key, "GEMINI_API_KEY 未設定").toBeDefined();
      expect(key!.length, "GEMINI_API_KEY 不應為空").toBeGreaterThan(0);
    });

    it("GEMINI_API_KEY 格式應符合 Google API Key 規範（以 AIza 開頭）", () => {
      const key = process.env.GEMINI_API_KEY ?? "";
      expect(key.startsWith("AIza"), `GEMINI_API_KEY 格式不正確，目前值開頭為: ${key.slice(0, 6)}...`).toBe(true);
    });
  });

  describe("SMTP Email 設定", () => {
    it("EMAIL_USER 應已設定且包含 @ 符號", () => {
      const user = process.env.EMAIL_USER;
      expect(user, "EMAIL_USER 未設定").toBeDefined();
      expect(user, "EMAIL_USER 應為有效的 Email 格式").toMatch(/@/);
    });

    it("EMAIL_PASS 應已設定且不為空", () => {
      const pass = process.env.EMAIL_PASS;
      expect(pass, "EMAIL_PASS 未設定").toBeDefined();
      expect(pass!.length, "EMAIL_PASS 不應為空").toBeGreaterThan(0);
    });

    it("SMTP transporter 應能成功建立（不實際發送）", async () => {
      const emailUser = process.env.EMAIL_USER;
      const emailPass = process.env.EMAIL_PASS;

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });

      // 只驗證 transporter 物件建立成功，不實際連線
      expect(transporter).toBeDefined();
      expect(typeof transporter.sendMail).toBe("function");
    });
  });
});
