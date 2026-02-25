import { getDb } from "./db";
import { assignments, demands, availability, workers, clients } from "../drizzle/schema";
import { inArray, or, like } from "drizzle-orm";

/**
 * 測試資料 ID 追蹤介面
 */
export interface TestDataIds {
  assignments?: number[];
  demands?: number[];
  availability?: number[];
  workers?: number[];
  clients?: number[];
}

/**
 * 統一的測試資料清理函式
 * 
 * 按照正確的外鍵依賴順序清理測試資料：
 * 1. assignments（最底層，沒有被其他表依賴）
 * 2. demands（被 assignments 依賴）
 * 3. availability（被 workers 依賴）
 * 4. workers（被 assignments, availability 依賴）
 * 5. clients（被 demands 依賴）
 * 
 * @param testDataIds - 要清理的測試資料 ID
 */
export async function cleanupTestData(testDataIds: TestDataIds): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Test] Cannot cleanup: database not available");
    return;
  }

  try {
    // 1. 清理 assignments
    if (testDataIds.assignments && testDataIds.assignments.length > 0) {
      await db.delete(assignments).where(
        inArray(assignments.id, testDataIds.assignments)
      );
    }

    // 2. 清理 demands（先清理所有關聯的 assignments）
    if (testDataIds.demands && testDataIds.demands.length > 0) {
      // 先查詢並清理所有關聯的 assignments（防止外鍵約束錯誤）
      const relatedAssignments = await db.select({ id: assignments.id })
        .from(assignments)
        .where(inArray(assignments.demandId, testDataIds.demands));
      
      if (relatedAssignments.length > 0) {
        const relatedAssignmentIds = relatedAssignments.map(a => a.id);
        await db.delete(assignments).where(
          inArray(assignments.id, relatedAssignmentIds)
        );
      }
      
      // 然後清理 demands
      await db.delete(demands).where(
        inArray(demands.id, testDataIds.demands)
      );
    }

    // 3. 清理 availability
    // 如果有指定 ID，按 ID 清理
    if (testDataIds.availability && testDataIds.availability.length > 0) {
      await db.delete(availability).where(
        inArray(availability.id, testDataIds.availability)
      );
    }
    // 否則根據 workerId 清理（因為 upsertAvailability 不返回 ID）
    else if (testDataIds.workers && testDataIds.workers.length > 0) {
      await db.delete(availability).where(
        inArray(availability.workerId, testDataIds.workers)
      );
    }

    // 4. 清理 workers
    if (testDataIds.workers && testDataIds.workers.length > 0) {
      await db.delete(workers).where(
        inArray(workers.id, testDataIds.workers)
      );
    }

    // 5. 清理 clients（先清理所有關聯的 demands 和 assignments）
    if (testDataIds.clients && testDataIds.clients.length > 0) {
      // 先查詢所有關聯的 demands
      const relatedDemands = await db.select({ id: demands.id })
        .from(demands)
        .where(inArray(demands.clientId, testDataIds.clients));
      
      if (relatedDemands.length > 0) {
        const relatedDemandIds = relatedDemands.map(d => d.id);
        
        // 先清理所有關聯的 assignments
        const relatedAssignments = await db.select({ id: assignments.id })
          .from(assignments)
          .where(inArray(assignments.demandId, relatedDemandIds));
        
        if (relatedAssignments.length > 0) {
          const relatedAssignmentIds = relatedAssignments.map(a => a.id);
          await db.delete(assignments).where(
            inArray(assignments.id, relatedAssignmentIds)
          );
        }
        
        // 然後清理 demands
        await db.delete(demands).where(
          inArray(demands.id, relatedDemandIds)
        );
      }
      
      // 最後清理 clients
      await db.delete(clients).where(
        inArray(clients.id, testDataIds.clients)
      );
    }
  } catch (error) {
    console.error("清理測試資料失敗:", error);
    throw error;
  }
}

/**
 * 清理所有包含測試標記的資料
 * 
 * 用於測試前的環境清理，確保沒有殘留的測試資料
 */
export async function cleanupAllTestData(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Test] Cannot cleanup: database not available");
    return;
  }

  try {
    // 1. 清理所有與測試員工或測試客戶相關的 assignments
    await db.execute(`
      DELETE FROM assignments 
      WHERE workerId IN (
        SELECT id FROM workers WHERE name LIKE '%測試%' OR name LIKE '%TEST%' OR name LIKE '%[測試]%'
      )
      OR demandId IN (
        SELECT d.id FROM demands d
        INNER JOIN clients c ON d.clientId = c.id
        WHERE c.name LIKE '%測試%' OR c.name LIKE '%TEST%' OR c.name LIKE '%[測試]%'
      )
    `);

    // 2. 清理測試客戶的 demands
    await db.delete(demands).where(
      or(
        like(demands.note, "%測試%"),
        like(demands.note, "%TEST%")
      )
    );

    // 3. 清理測試員工的 availability
    await db.execute(`
      DELETE FROM availability 
      WHERE workerId IN (
        SELECT id FROM workers WHERE name LIKE '%測試%' OR name LIKE '%TEST%' OR name LIKE '%[測試]%'
      )
    `);

    // 4. 清理測試員工
    await db.delete(workers).where(
      or(
        like(workers.name, "%測試%"),
        like(workers.name, "%TEST%"),
        like(workers.name, "%[測試]%")
      )
    );

    // 5. 清理測試客戶
    await db.delete(clients).where(
      or(
        like(clients.name, "%測試%"),
        like(clients.name, "%TEST%"),
        like(clients.name, "%[測試]%")
      )
    );
  } catch (error) {
    console.error("清理所有測試資料失敗:", error);
    throw error;
  }
}

/**
 * 初始化測試資料 ID 追蹤物件
 */
export function createTestDataIds(): TestDataIds {
  return {
    assignments: [],
    demands: [],
    availability: [],
    workers: [],
    clients: [],
  };
}
