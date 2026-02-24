import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { clients } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

// 連接資料庫
const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// 生成 clientCode 的函式
function generateClientCode(id, createdAt) {
  const date = new Date(createdAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const sequence = String(id).padStart(3, '0');
  return `CLI-${year}${month}${day}-${sequence}`;
}

try {
  // 查詢所有客戶
  const allClients = await db.select().from(clients);
  
  console.log(`找到 ${allClients.length} 位客戶`);
  
  // 為每位客戶生成 clientCode
  for (const client of allClients) {
    if (!client.clientCode) {
      const clientCode = generateClientCode(client.id, client.createdAt);
      await db.update(clients)
        .set({ clientCode })
        .where(eq(clients.id, client.id));
      console.log(`✓ 客戶 #${client.id} (${client.name}): ${clientCode}`);
    } else {
      console.log(`- 客戶 #${client.id} (${client.name}): 已有 clientCode ${client.clientCode}`);
    }
  }
  
  console.log('\n✅ 所有客戶的 clientCode 已生成完成！');
  
} catch (error) {
  console.error('❌ 錯誤：', error);
} finally {
  await connection.end();
}
