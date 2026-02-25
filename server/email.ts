import nodemailer from "nodemailer";

/**
 * Email 發送設定
 * 
 * 使用 Gmail SMTP 發送 Email
 * 需要在環境變數設定：
 * - EMAIL_USER: Gmail 帳號
 * - EMAIL_PASS: Gmail 應用程式密碼（非一般密碼）
 */

// 建立 transporter
const createTransporter = () => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.warn("[Email] 未設定 EMAIL_USER 或 EMAIL_PASS，Email 發送功能將無法使用");
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
};

/**
 * 發送 Email
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const transporter = createTransporter();

  if (!transporter) {
    console.log(`[Email] 模擬發送 Email 到 ${options.to}`);
    console.log(`[Email] 主旨: ${options.subject}`);
    console.log(`[Email] 內容:\n${options.html}`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"員工排班系統" <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log(`[Email] 成功發送 Email 到 ${options.to}`);
    return true;
  } catch (error) {
    console.error(`[Email] 發送失敗:`, error);
    return false;
  }
}

/**
 * 新帳號通知 Email 範本
 */
export function createNewAccountEmail(data: {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>歡迎使用員工排班系統</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Microsoft JhengHei', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">歡迎使用員工排班系統</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                親愛的 <strong>${data.name}</strong>，您好：
              </p>
              
              <p style="margin: 0 0 20px; color: #666666; font-size: 14px; line-height: 1.6;">
                您的帳號已成功建立！以下是您的登入資訊：
              </p>
              
              <!-- Account Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 6px; margin: 30px 0;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 14px;">Email 帳號</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <strong style="color: #1e293b; font-size: 14px;">${data.email}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #e2e8f0;">
                          <span style="color: #64748b; font-size: 14px;">初始密碼</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right; border-top: 1px solid #e2e8f0;">
                          <code style="background-color: #ffffff; padding: 4px 8px; border-radius: 4px; color: #dc2626; font-size: 16px; font-weight: 600;">${data.password}</code>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 20px; color: #666666; font-size: 14px; line-height: 1.6;">
                請點擊下方按鈕前往登入頁面：
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${data.loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                      立即登入
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Security Notice -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.6;">
                  <strong>⚠️ 安全提醒</strong><br>
                  首次登入後，系統將要求您修改密碼。請務必設定一個安全的新密碼，並妥善保管。
                </p>
              </div>
              
              <p style="margin: 30px 0 0; color: #999999; font-size: 12px; line-height: 1.6;">
                如果您沒有申請此帳號，請忽略此信件。
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                © 2026 員工排班系統 · All rights reserved
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * 重設密碼 Email 範本
 */
export function createResetPasswordEmail(data: {
  email: string;
  resetUrl: string;
  expiresIn: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>重設密碼</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Microsoft JhengHei', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">重設密碼</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                您好：
              </p>
              
              <p style="margin: 0 0 20px; color: #666666; font-size: 14px; line-height: 1.6;">
                我們收到了您的密碼重設請求。請點擊下方按鈕來設定新密碼：
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 30px 0;">
                    <a href="${data.resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);">
                      重設密碼
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                或複製以下連結到瀏覽器：
              </p>
              
              <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; word-break: break-all;">
                <a href="${data.resetUrl}" style="color: #3b82f6; font-size: 13px; text-decoration: none;">
                  ${data.resetUrl}
                </a>
              </div>
              
              <!-- Security Notice -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.6;">
                  <strong>⚠️ 重要提醒</strong><br>
                  此連結將在 <strong>${data.expiresIn}</strong> 後失效。<br>
                  如果您沒有申請重設密碼，請忽略此信件，您的密碼不會被更改。
                </p>
              </div>
              
              <p style="margin: 30px 0 0; color: #999999; font-size: 12px; line-height: 1.6;">
                為了您的帳號安全，請勿將此連結分享給他人。
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                © 2026 員工排班系統 · All rights reserved
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
