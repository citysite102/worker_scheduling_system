import { describe, it, expect } from "vitest";
import { sendEmail } from "./email";

describe("Email 發送驗證測試", () => {
  it("應該能夠成功發送測試 Email", async () => {
    const hasEmailConfig = process.env.EMAIL_USER && process.env.EMAIL_PASS;
    
    if (!hasEmailConfig) {
      console.log("[Email 驗證] 未設定 EMAIL_USER 或 EMAIL_PASS，跳過測試");
      return;
    }

    // 發送測試 Email 到設定的信箱
    const result = await sendEmail({
      to: process.env.EMAIL_USER!,
      subject: "員工排班系統 - Email 功能驗證測試",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1e40af;">✅ Email 功能驗證成功！</h1>
          <p>這是一封測試 Email，用於驗證系統的 Email 發送功能是否正常運作。</p>
          <p><strong>如果您收到這封信，表示 Gmail SMTP 設定正確！</strong></p>
          <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            測試時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
          </p>
        </div>
      `,
    });

    expect(result).toBe(true);
  }, 30000); // 30 秒超時
});
