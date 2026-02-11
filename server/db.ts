import { eq, and, gte, lte, lt, or, sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

import { workers, clients, availability, demands, assignments, adminInvites } from "../drizzle/schema";

// ============ Workers ============
export async function getAllWorkers(filters?: {
  status?: "active" | "inactive";
  search?: string;
  school?: string;
  hasWorkPermit?: boolean;
  hasHealthCheck?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(workers);
  const conditions = [];

  if (filters?.status) {
    conditions.push(eq(workers.status, filters.status));
  }

  if (filters?.search) {
    conditions.push(
      or(
        sql`${workers.name} LIKE ${`%${filters.search}%`}`,
        sql`${workers.phone} LIKE ${`%${filters.search}%`}`,
        sql`${workers.email} LIKE ${`%${filters.search}%`}`,
        sql`${workers.school} LIKE ${`%${filters.search}%`}`
      )
    );
  }

  if (filters?.school) {
    conditions.push(sql`${workers.school} LIKE ${`%${filters.school}%`}`);
  }

  if (filters?.hasWorkPermit !== undefined) {
    conditions.push(eq(workers.hasWorkPermit, filters.hasWorkPermit ? 1 : 0));
  }

  if (filters?.hasHealthCheck !== undefined) {
    conditions.push(eq(workers.hasHealthCheck, filters.hasHealthCheck ? 1 : 0));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return await query;
}

export async function getWorkerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
  return result[0];
}

export async function createWorker(data: { name: string; phone: string; email?: string; school?: string; hasWorkPermit?: number; hasHealthCheck?: number; status?: "active" | "inactive"; note?: string; lineId?: string; whatsappId?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(workers).values(data);
  // 返回新建立的記錄
  const [newWorker] = await db.select().from(workers).orderBy(desc(workers.id)).limit(1);
  return newWorker;
}

export async function updateWorker(id: number, data: Partial<{ name: string; phone: string; email?: string; school?: string; hasWorkPermit?: number; hasHealthCheck?: number; status: "active" | "inactive"; note?: string; lineId?: string; whatsappId?: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(workers).set(data).where(eq(workers.id, id));
}

export async function deleteWorker(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(workers).where(eq(workers.id, id));
}

// ============ Clients ============
export async function getAllClients(statusFilter?: "active" | "inactive", searchTerm?: string) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(clients);
  const conditions = [];

  if (statusFilter) {
    conditions.push(eq(clients.status, statusFilter));
  }

  if (searchTerm) {
    conditions.push(
      or(
        sql`${clients.name} LIKE ${`%${searchTerm}%`}`,
        sql`${clients.contactName} LIKE ${`%${searchTerm}%`}`,
        sql`${clients.contactPhone} LIKE ${`%${searchTerm}%`}`
      )
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return await query;
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}

export async function createClient(data: { name: string; contactName?: string; contactEmail?: string; contactPhone?: string; address?: string; billingType?: "hourly" | "fixed" | "custom"; note?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(clients).values(data);
  // 返回新建立的記錄
  const [newClient] = await db.select().from(clients).orderBy(desc(clients.id)).limit(1);
  return newClient;
}

export async function updateClient(id: number, data: Partial<{ name: string; contactName?: string; contactEmail?: string; contactPhone?: string; address?: string; billingType?: "hourly" | "fixed" | "custom"; status: "active" | "inactive"; note?: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clients).set(data).where(eq(clients.id, id));
}

export async function deleteClient(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(clients).where(eq(clients.id, id));
}

// ============ Availability ============
export async function getAvailabilityByWeek(weekStartDate: Date) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(availability).where(eq(availability.weekStartDate, weekStartDate));
  return result;
}

export async function getAvailabilityByWorkerAndWeek(workerId: number, weekStartDate: Date) {
  const db = await getDb();
  if (!db) return undefined;
  
  // 使用 UTC 日期範圍查詢避免時區問題
  const dayStart = new Date(Date.UTC(
    weekStartDate.getUTCFullYear(),
    weekStartDate.getUTCMonth(),
    weekStartDate.getUTCDate(),
    0, 0, 0, 0
  ));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  
  const result = await db.select().from(availability).where(
    and(
      eq(availability.workerId, workerId),
      gte(availability.weekStartDate, dayStart),
      lt(availability.weekStartDate, dayEnd)
    )
  ).limit(1);
  
  return result[0];
}

export async function upsertAvailability(data: { workerId: number; weekStartDate: Date; weekEndDate: Date; timeBlocks: string; confirmedAt?: Date | null; note?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 查詢該週的所有記錄（不只是第一筆）
  const dayStart = new Date(Date.UTC(
    data.weekStartDate.getUTCFullYear(),
    data.weekStartDate.getUTCMonth(),
    data.weekStartDate.getUTCDate(),
    0, 0, 0, 0
  ));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 7);
  
  const existingRecords = await db.select().from(availability).where(
    and(
      eq(availability.workerId, data.workerId),
      gte(availability.weekStartDate, dayStart),
      lt(availability.weekStartDate, dayEnd)
    )
  );
  
  if (existingRecords.length > 0) {
    // 如果有多筆記錄，刪除其他記錄，只保留第一筆
    if (existingRecords.length > 1) {
      const idsToDelete = existingRecords.slice(1).map(r => r.id);
      for (const id of idsToDelete) {
        await db.delete(availability).where(eq(availability.id, id));
      }
    }
    // 更新第一筆記錄
    await db.update(availability).set(data).where(eq(availability.id, existingRecords[0].id));
    return existingRecords[0].id;
  } else {
    const result = await db.insert(availability).values(data);
    return result;
  }
}

// ============ Demands ============
export async function getAllDemands(statusFilter?: string, dateFilter?: Date) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(demands).orderBy(desc(demands.createdAt));
  const conditions = [];

  if (statusFilter) {
    conditions.push(eq(demands.status, statusFilter as any));
  }

  if (dateFilter) {
    const startOfDay = new Date(dateFilter);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateFilter);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(and(gte(demands.date, startOfDay), lte(demands.date, endOfDay)));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return await query;
}

export async function getDemandById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(demands).where(eq(demands.id, id)).limit(1);
  return result[0];
}

export async function createDemand(data: { clientId: number; date: Date; startTime: string; endTime: string; requiredWorkers: number; location?: string; note?: string; status?: "draft" | "confirmed" | "cancelled" | "closed" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 明確指定要插入的欄位，確保 clientId 正確傳遞
  const insertData: any = {
    clientId: data.clientId,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    requiredWorkers: data.requiredWorkers,
    status: data.status || "draft",
  };
  if (data.location) insertData.location = data.location;
  if (data.note) insertData.note = data.note;
  
  const result = await db.insert(demands).values(insertData);
  // 返回新建立的完整 demand 物件
  const [newDemand] = await db.select().from(demands).orderBy(desc(demands.id)).limit(1);
  return newDemand;
}

export async function updateDemand(id: number, data: Partial<{ clientId: number; date: Date; startTime: string; endTime: string; requiredWorkers: number; location?: string; note?: string; status: "draft" | "confirmed" | "cancelled" | "closed" }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(demands).set(data).where(eq(demands.id, id));
}

export async function deleteDemand(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(demands).where(eq(demands.id, id));
}

// ============ Assignments ============
export async function getAssignmentsByDemand(demandId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(assignments).where(eq(assignments.demandId, demandId));
}

export async function getAssignmentsByWorker(workerId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(assignments.workerId, workerId)];

  if (startDate && endDate) {
    conditions.push(gte(assignments.scheduledStart, startDate));
    conditions.push(lte(assignments.scheduledEnd, endDate));
  }

  return await db.select().from(assignments).where(and(...conditions));
}

export async function getAssignmentsByDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(assignments).where(
    and(
      gte(assignments.scheduledStart, startDate),
      lte(assignments.scheduledEnd, endDate)
    )
  );
}

export async function createAssignment(data: { demandId: number; workerId: number; scheduledStart: Date; scheduledEnd: Date; scheduledHours: number; status?: "assigned" | "completed" | "cancelled" | "disputed"; note?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(assignments).values(data);
  // 返回新建立的完整 assignment 物件
  const [newAssignment] = await db.select().from(assignments).orderBy(desc(assignments.id)).limit(1);
  return newAssignment;
}

export async function getAssignmentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
  return result[0];
}

export async function updateAssignment(id: number, data: Partial<{ actualStart?: Date; actualEnd?: Date; actualStartTime?: string; actualEndTime?: string; actualHours?: number; varianceHours?: number; status: "assigned" | "completed" | "cancelled" | "disputed"; note?: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(assignments).set(data).where(eq(assignments.id, id));
}

export async function deleteAssignment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(assignments).where(eq(assignments.id, id));
}

// ============ Admin Invites ============
export async function createAdminInvite(data: { code: string; createdBy: number; expiresAt?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(adminInvites).values(data);
}

export async function getAdminInviteByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(adminInvites).where(eq(adminInvites.code, code)).limit(1);
  return result[0];
}

export async function getAllAdminInvites() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(adminInvites).orderBy(desc(adminInvites.createdAt));
}

export async function updateAdminInvite(id: number, data: Partial<{ usedBy: number; usedAt: Date; status: "active" | "used" | "expired" | "revoked" }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(adminInvites).set(data).where(eq(adminInvites.id, id));
}

export async function getAllAdmins() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).where(eq(users.role, "admin"));
}

export async function updateUserRole(userId: number, role: "admin" | "user") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ============ Worker Detail Queries ============

/** 取得員工所有歷史指派（含需求單與客戶資訊），按日期倒序 */
export async function getWorkerAssignmentHistory(workerId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(assignments)
    .where(eq(assignments.workerId, workerId))
    .orderBy(desc(assignments.scheduledStart));
}

/** 取得員工所有排班紀錄，按週倒序 */
export async function getWorkerAvailabilityHistory(workerId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(availability)
    .where(eq(availability.workerId, workerId))
    .orderBy(desc(availability.weekStartDate));
}
