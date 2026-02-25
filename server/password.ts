import bcrypt from "bcrypt";
import crypto from "crypto";

/**
 * 密碼加密與驗證工具函式
 */

const SALT_ROUNDS = 10;

/**
 * 加密密碼
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 驗證密碼
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * 生成隨機密碼（8 位數，包含大小寫字母和數字）
 */
export function generateRandomPassword(): string {
  const length = 8;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  
  // 確保至少包含一個大寫字母、一個小寫字母和一個數字
  password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
  password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
  password += "0123456789"[Math.floor(Math.random() * 10)];
  
  // 填充剩餘字元
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // 打亂順序
  return password.split("").sort(() => Math.random() - 0.5).join("");
}

/**
 * 生成重設密碼 token（32 位元組隨機字串）
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
