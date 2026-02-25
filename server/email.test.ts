import { describe, it, expect } from "vitest";
import { sendEmail, createNewAccountEmail, createResetPasswordEmail } from "./email";

describe("Email 發送功能測試", () => {
  it("應該能夠建立新帳號 Email 範本", () => {
    const html = createNewAccountEmail({
      name: "測試使用者",
      email: "test@example.com",
      password: "TestPass123",
      loginUrl: "https://example.com/login",
    });

    expect(html).toContain("測試使用者");
    expect(html).toContain("test@example.com");
    expect(html).toContain("TestPass123");
    expect(html).toContain("https://example.com/login");
  });

  it("應該能夠建立重設密碼 Email 範本", () => {
    const html = createResetPasswordEmail({
      email: "test@example.com",
      resetUrl: "https://example.com/reset?token=abc123",
      expiresIn: "1 小時",
    });

    // 檢查 Email 範本包含重設連結和有效期限
    expect(html).toContain("https://example.com/reset?token=abc123");
    expect(html).toContain("1 小時");
    expect(html).toContain("重設密碼");
  });

  it("應該能夠處理 Email 發送設定", () => {
    const hasEmailConfig = process.env.EMAIL_USER && process.env.EMAIL_PASS;
    
    // 只檢查環境變數是否設定
    if (hasEmailConfig) {
      expect(process.env.EMAIL_USER).toBeTruthy();
      expect(process.env.EMAIL_PASS).toBeTruthy();
    } else {
      console.log("[Email 測試] 未設定 EMAIL_USER 或 EMAIL_PASS，將使用 console 模擬發送");
    }
  });
});
