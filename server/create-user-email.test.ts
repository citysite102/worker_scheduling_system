import { describe, it, expect } from "vitest";
import { hashPassword, generateRandomPassword } from "./password";
import { createNewAccountEmail, sendEmail } from "./email";

describe("建立使用者帳號 Email 發送測試", () => {
  it("應該能夠生成新帳號 Email 並成功發送", async () => {
    const hasEmailConfig = process.env.EMAIL_USER && process.env.EMAIL_PASS;
    
    if (!hasEmailConfig) {
      console.log("[Email 驗證] 未設定 EMAIL_USER 或 EMAIL_PASS，跳過測試");
      return;
    }

    // 模擬建立使用者的流程
    const testUser = {
      name: "Email測試使用者",
      email: process.env.EMAIL_USER!, // 發送到設定的信箱
      position: "測試人員",
      phone: "0912-345-678",
    };

    // 生成隨機密碼
    const password = generateRandomPassword();
    console.log(`[測試] 生成的密碼: ${password}`);

    // 建立 Email 內容
    const emailHtml = createNewAccountEmail({
      name: testUser.name,
      email: testUser.email,
      password,
      loginUrl: "https://3000-iiblio0nihjy2624ys9xp-3671b168.sg1.manus.computer/client-login",
    });

    // 發送 Email
    const result = await sendEmail({
      to: testUser.email,
      subject: "【員工排班系統】您的帳號已建立",
      html: emailHtml,
    });

    console.log(`[測試] Email 發送結果: ${result ? '成功' : '失敗'}`);
    expect(result).toBe(true);
  }, 30000); // 30 秒超時
});
