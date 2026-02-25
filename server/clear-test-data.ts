/**
 * 清除測試資料腳本
 * 
 * 此腳本會清除所有測試產生的資料，包括：
 * - 測試員工（workers）
 * - 測試客戶（clients）
 * - 測試需求單（demands）
 * - 測試指派（assignments）
 * - 測試排班資料（availability）
 * 
 * 執行方式：node --import tsx server/clear-test-data.ts
 */

import { getDb } from "./db";
import { sql } from "drizzle-orm";

async function clearTestData() {
  console.log("開始清除測試資料...");
  
  const db = await getDb();
  if (!db) {
    throw new Error("無法連接資料庫");
  }
  
  try {
    // 1. 清除 assignments 表（需要先清除，因為有外鍵關聯）
    console.log("清除 assignments 表...");
    await db.execute(sql`DELETE FROM assignments`);
    console.log(`✓ 已清除 assignments 資料`);
    
    // 2. 清除 availability 表
    console.log("清除 availability 表...");
    await db.execute(sql`DELETE FROM availability`);
    console.log(`✓ 已清除 availability 資料`);
    
    // 3. 清除 demands 表
    console.log("清除 demands 表...");
    await db.execute(sql`DELETE FROM demands`);
    console.log(`✓ 已清除 demands 資料`);
    
    // 4. 清除 workers 表
    console.log("清除 workers 表...");
    await db.execute(sql`DELETE FROM workers`);
    console.log(`✓ 已清除 workers 資料`);
    
    // 5. 清除 clients 表（保留系統管理員相關的客戶）
    console.log("清除 clients 表...");
    await db.execute(sql`DELETE FROM clients`);
    console.log(`✓ 已清除 clients 資料`);
    
    // 6. 清除 users 表中的 client 角色使用者（保留 admin 角色）
    console.log("清除 users 表中的 client 角色使用者...");
    await db.execute(sql`DELETE FROM users WHERE role = 'client'`);
    console.log(`✓ 已清除 client 使用者資料`);
    
    console.log("\n✅ 所有測試資料已清除完成！");
    console.log("\n保留的資料：");
    console.log("- admin 角色的使用者");
    console.log("- demandTypes 和 demandTypeOptions（需求類型和選項）");
    console.log("- adminInvites（管理員邀請碼）");
    
  } catch (error) {
    console.error("清除資料時發生錯誤：", error);
    throw error;
  }
}

// 執行清除
clearTestData()
  .then(() => {
    console.log("\n腳本執行完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n腳本執行失敗：", error);
    process.exit(1);
  });
