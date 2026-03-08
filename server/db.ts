import { eq, and, gte, lte, lt, or, sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { InsertUser, users, payrollSettlements } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // 強制使用 UTC 時區，避免 mysql2 預設 'local' 造成時間偏移
      const pool = mysql.createPool({ uri: process.env.DATABASE_URL, timezone: '+00:00' });
      _db = drizzle(pool as any);
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

import { workers, clients, availability, demands, assignments, adminInvites, users as usersTable } from "../drizzle/schema";
import { alias } from "drizzle-orm/mysql-core";

// ============ Workers ============
export async function getAllWorkers(filters?: {
  status?: "active" | "inactive";
  search?: string;
  school?: string;
  workPermitStatus?: "valid" | "invalid" | "none";
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

  if (filters?.workPermitStatus) {
    const now = new Date();
    if (filters.workPermitStatus === "valid") {
      // 簽證有效：有簽證 且 到期日 > 今天
      conditions.push(
        and(
          eq(workers.hasWorkPermit, 1),
          sql`${workers.workPermitExpiryDate} IS NOT NULL`,
          sql`${workers.workPermitExpiryDate} > ${now}`
        )
      );
    } else if (filters.workPermitStatus === "invalid") {
      // 簽證無效：有簽證 且 (到期日 <= 今天 或 無到期日)
      conditions.push(
        and(
          eq(workers.hasWorkPermit, 1),
          or(
            sql`${workers.workPermitExpiryDate} IS NULL`,
            sql`${workers.workPermitExpiryDate} <= ${now}`
          )
        )
      );
    } else if (filters.workPermitStatus === "none") {
      // 無簽證
      conditions.push(eq(workers.hasWorkPermit, 0));
    }
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

export async function createWorker(data: { name: string; phone?: string; email?: string; school?: string; nationality?: string; idNumber?: string | null; hasWorkPermit?: number; hasHealthCheck?: number; workPermitExpiryDate?: Date; attendanceNotes?: string; status?: "active" | "inactive"; note?: string; lineId?: string; whatsappId?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(workers).values(data);
  // 返回新建立的記錄
  const [newWorker] = await db.select().from(workers).orderBy(desc(workers.id)).limit(1);
  return newWorker;
}

export async function updateWorker(id: number, data: Partial<{ name: string; phone?: string; email?: string; school?: string; nationality?: string; idNumber?: string | null; hasWorkPermit?: number; hasHealthCheck?: number; workPermitExpiryDate?: Date; attendanceNotes?: string; status: "active" | "inactive"; note?: string; lineId?: string; whatsappId?: string }>) {
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

  // 按建立時間降序排列，最新建立的客戶排在最前面
  query = query.orderBy(desc(clients.createdAt)) as any;

  return await query;
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}

export async function getClientByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.name, name)).limit(1);
  return result[0];
}

export async function createClient(data: { name: string; contactName?: string; contactEmail?: string; contactPhone?: string; address?: string; logoUrl?: string; billingType?: "hourly" | "fixed" | "custom"; note?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 生成 clientCode
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  // 查詢今天最大的 clientCode 序號，避免删除後重複
  const prefix = `CLI-${year}${month}${day}-`;
  const [lastClient] = await db
    .select({ clientCode: clients.clientCode })
    .from(clients)
    .where(sql`${clients.clientCode} LIKE ${prefix + '%'}`)
    .orderBy(desc(clients.clientCode))
    .limit(1);
  
  let nextSeq = 1;
  if (lastClient) {
    const lastSeq = parseInt(lastClient.clientCode.slice(prefix.length), 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }
  const clientCode = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  
  // 插入資料（包含 clientCode）
  // 注意：Drizzle ORM 對 undefined 欄位會產生 SQL `default` 關鍵字，
  // 但 optional 欄位在 schema 中沒有 default 值，必須明確傳入 null
  await db.insert(clients).values({
    clientCode,
    name: data.name,
    contactName: data.contactName ?? null,
    contactEmail: data.contactEmail ?? null,
    contactPhone: data.contactPhone ?? null,
    address: data.address ?? null,
    logoUrl: data.logoUrl ?? null,
    billingType: data.billingType ?? "hourly",
    note: data.note ?? null,
  });
  
  // 返回新建立的記錄
  const [newClient] = await db.select().from(clients).orderBy(desc(clients.id)).limit(1);
  return newClient;
}

export async function updateClient(id: number, data: Partial<{ name: string; contactName?: string; contactEmail?: string; contactPhone?: string; address?: string; logoUrl?: string; billingType?: "hourly" | "fixed" | "custom"; status: "active" | "inactive"; note?: string }>) {
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
export async function getAllDemands(statusFilter?: string, dateFilter?: Date, clientIdFilter?: number) {
  const db = await getDb();
  if (!db) return [];

  // 建立 createdByUser alias，用於 JOIN 建立者資訊
  const createdByUser = alias(usersTable, "createdByUser");

  // 使用 JOIN 查詢一次取得所有需要的資料，避免 N+1 問題
  let query = db
    .select({
      // demand 欄位
      id: demands.id,
      clientId: demands.clientId,
      date: demands.date,
      startTime: demands.startTime,
      endTime: demands.endTime,
      requiredWorkers: demands.requiredWorkers,
      breakHours: demands.breakHours,
      location: demands.location,
      status: demands.status,
      note: demands.note,
      demandTypeId: demands.demandTypeId,
      selectedOptions: demands.selectedOptions,
      createdAt: demands.createdAt,
      updatedAt: demands.updatedAt,
      createdBy: demands.createdBy,
      
      // client 欄位（直接 JOIN）
      clientName: clients.name,
      clientLogoUrl: clients.logoUrl,
      clientStatus: clients.status,
      clientContactName: clients.contactName,
      clientContactEmail: clients.contactEmail,
      clientContactPhone: clients.contactPhone,
      clientAddress: clients.address,
      clientBillingType: clients.billingType,
      clientClientCode: clients.clientCode,

      // 建立者資訊（LEFT JOIN users）
      createdByName: createdByUser.name,
      createdByRole: createdByUser.role,
      
      // 已指派人數（使用子查詢）
      assignedCount: sql<number>`(
        SELECT COUNT(*) 
        FROM ${assignments} 
        WHERE ${assignments.demandId} = ${demands.id} 
        AND ${assignments.status} != 'cancelled'
      )`,
    })
    .from(demands)
    .leftJoin(clients, eq(demands.clientId, clients.id))
    .leftJoin(createdByUser, eq(demands.createdBy, createdByUser.id))
    .orderBy(desc(demands.createdAt));
  
  const conditions = [];

  if (statusFilter) {
    conditions.push(eq(demands.status, statusFilter as any));
  }
  
  if (clientIdFilter) {
    conditions.push(eq(demands.clientId, clientIdFilter));
  }

  if (dateFilter) {
    const startOfDay = new Date(dateFilter);
    startOfDay.setUTCHours(0, 0, 0, 0); // 使用 UTC 避免伺服器本地時區影響
    const endOfDay = new Date(dateFilter);
    endOfDay.setUTCHours(23, 59, 59, 999); // 使用 UTC 避免伺服器本地時區影響
    conditions.push(and(gte(demands.date, startOfDay), lte(demands.date, endOfDay)));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const results = await query;
  
  // 將查詢結果轉換為原本的格式（demand + client 嵌套物件）
  return results.map(row => ({
    id: row.id,
    clientId: row.clientId,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    requiredWorkers: row.requiredWorkers,
    breakHours: row.breakHours,
    location: row.location,
    status: row.status,
    note: row.note,
    demandTypeId: row.demandTypeId,
    selectedOptions: row.selectedOptions,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
    createdByName: row.createdByName,
    createdByRole: row.createdByRole,
    client: {
      id: row.clientId,
      name: row.clientName,
      logoUrl: row.clientLogoUrl,
      status: row.clientStatus,
      contactName: row.clientContactName,
      contactEmail: row.clientContactEmail,
      contactPhone: row.clientContactPhone,
      address: row.clientAddress,
      billingType: row.clientBillingType,
      clientCode: row.clientClientCode,
    },
    assignedCount: row.assignedCount,
  }));
}

export async function getDemandById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(demands).where(eq(demands.id, id)).limit(1);
  return result[0];
}

export async function getDemandsByClientId(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(demands).where(eq(demands.clientId, clientId)).orderBy(desc(demands.date));
}

export async function createDemand(data: { clientId: number; date: Date; startTime: string; endTime: string; requiredWorkers: number; breakHours?: number; location?: string; note?: string; status?: "draft" | "pending" | "confirmed" | "assigned" | "completed" | "cancelled" | "closed"; createdBy?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 明確指定要插入的欄位，確保 clientId 正確傳遞
  const insertData: any = {
    clientId: data.clientId,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    requiredWorkers: data.requiredWorkers,
    breakHours: data.breakHours || 0,
    status: data.status || "draft",
  };
  if (data.location) insertData.location = data.location;
  if (data.note) insertData.note = data.note;
  if (data.createdBy) insertData.createdBy = data.createdBy;
  
  const result = await db.insert(demands).values(insertData);
  // 返回新建立的完整 demand 物件
  const [newDemand] = await db.select().from(demands).orderBy(desc(demands.id)).limit(1);
  return newDemand;
}

export async function updateDemand(id: number, data: Partial<{ clientId: number; date: Date; startTime: string; endTime: string; requiredWorkers: number; breakHours?: number; location?: string; note?: string; status: "draft" | "pending" | "confirmed" | "assigned" | "completed" | "cancelled" | "closed" }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(demands).set(data).where(eq(demands.id, id));
  
  // 返回更新後的需求單
  const [updatedDemand] = await db.select().from(demands).where(eq(demands.id, id));
  return updatedDemand;
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
  // 使用 scheduledStart 的日期範圍查詢，支援跨日班次（scheduledEnd 可能跨到隔天）
  return await db.select().from(assignments).where(
    and(
      gte(assignments.scheduledStart, startDate),
      lte(assignments.scheduledStart, endDate)
    )
  );
}

/**
 * 依台灣時區日期查詢指派記錄
 * 使用 MySQL CONVERT_TZ 把 UTC 的 scheduledStart 轉成台灣時間（+08:00）後比對日期
 * 完全繞過 Node.js / mysql2 的時區序列化問題
 * @param dateStr 台灣時區的日期字串，格式 YYYY-MM-DD
 */
export async function getAssignmentsByTaiwanDate(dateStr: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(assignments).where(
    sql`DATE(CONVERT_TZ(${assignments.scheduledStart}, '+00:00', '+08:00')) = ${dateStr}`
  );
}

/**
 * 依台灣時區日期範圍查詢指派記錄（用於月報、週報等範圍查詢）
 * 使用 MySQL CONVERT_TZ 把 UTC 的 scheduledStart 轉成台灣時間（+08:00）後比對日期範圍
 * @param startDateStr 開始日期字串，格式 YYYY-MM-DD
 * @param endDateStr 結束日期字串，格式 YYYY-MM-DD
 */
export async function getAssignmentsByTaiwanDateRange(startDateStr: string, endDateStr: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(assignments).where(
    sql`DATE(CONVERT_TZ(${assignments.scheduledStart}, '+00:00', '+08:00')) BETWEEN ${startDateStr} AND ${endDateStr}`
  );
}

export async function createAssignment(data: { demandId: number; workerId: number; scheduledStart: Date; scheduledEnd: Date; scheduledHours: number; role?: "regular" | "intern"; status?: "assigned" | "completed" | "cancelled" | "disputed"; note?: string }) {
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

export async function updateAssignment(id: number, data: Partial<{ actualStart?: Date; actualEnd?: Date; actualStartTime?: string; actualEndTime?: string; actualHours?: number; varianceHours?: number; status: "assigned" | "completed" | "cancelled" | "disputed"; note?: string; payType?: "hourly" | "unit" | "fixed"; unitCount?: number; unitType?: string; payRate?: number; payAmount?: number }>) {
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

// ==================== DemandType Management ====================

import { demandTypes, demandTypeOptions, InsertDemandType, InsertDemandTypeOption } from "../drizzle/schema";

/**
 * 取得所有需求類型（含選項）
 */
export async function getAllDemandTypes() {
  const db = await getDb();
  if (!db) return [];
  
  const types = await db.select().from(demandTypes);
  const options = await db.select().from(demandTypeOptions);
  
  return types.map(type => ({
    ...type,
    options: options.filter(opt => opt.demandTypeId === type.id).sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

/**
 * 根據 ID 取得需求類型（含選項）
 */
export async function getDemandTypeById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const [type] = await db.select().from(demandTypes).where(eq(demandTypes.id, id));
  if (!type) return null;
  
  const options = await db.select().from(demandTypeOptions).where(eq(demandTypeOptions.demandTypeId, id));
  
  return {
    ...type,
    options: options.sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

/**
 * 建立需求類型
 */
export async function createDemandType(data: InsertDemandType) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(demandTypes).values(data);
  return result.insertId;
}

/**
 * 更新需求類型
 */
export async function updateDemandType(id: number, data: Partial<InsertDemandType>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(demandTypes).set(data).where(eq(demandTypes.id, id));
}

/**
 * 刪除需求類型（同時刪除所有選項）
 */
export async function deleteDemandType(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 先刪除所有選項
  await db.delete(demandTypeOptions).where(eq(demandTypeOptions.demandTypeId, id));
  // 再刪除需求類型
  await db.delete(demandTypes).where(eq(demandTypes.id, id));
}

/**
 * 為需求類型新增選項
 */
export async function createDemandTypeOption(data: InsertDemandTypeOption) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(demandTypeOptions).values(data);
  return result.insertId;
}

/**
 * 更新需求類型選項
 */
export async function updateDemandTypeOption(id: number, data: Partial<InsertDemandTypeOption>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(demandTypeOptions).set(data).where(eq(demandTypeOptions.id, id));
}

/**
 * 刪除需求類型選項
 */
export async function deleteDemandTypeOption(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(demandTypeOptions).where(eq(demandTypeOptions.id, id));
}

/**
 * 批次更新需求類型選項的排序
 */
export async function updateDemandTypeOptionsOrder(updates: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const update of updates) {
    await db.update(demandTypeOptions)
      .set({ sortOrder: update.sortOrder })
      .where(eq(demandTypeOptions.id, update.id));
  }
}

// ============ Client Users Management ============

/**
 * 依據 Email 查詢使用者（用於重複檢查）
 */
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * 為客戶建立使用者帳號
 */
export async function createClientUser(data: {
  clientId: number;
  name: string;
  email: string;
  position?: string;
  phone?: string;
  openId: string;
  password?: string;
  mustChangePassword?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(users).values({
    openId: data.openId,
    name: data.name,
    email: data.email,
    role: "client",
    clientId: data.clientId,
    position: data.position || null,
    phone: data.phone || null,
    password: data.password || null,
    mustChangePassword: data.mustChangePassword || 0,
  });
}

/**
 * 列出客戶的所有使用者
 */
export async function getClientUsers(clientId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select()
    .from(users)
    .where(eq(users.clientId, clientId));

  return result;
}

/**
 * 更新客戶使用者資訊
 */
export async function updateClientUser(userId: number, data: {
  name?: string;
  email?: string;
  position?: string;
  phone?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set(data)
    .where(eq(users.id, userId));
}

/**
 * 刪除客戶使用者
 */
export async function deleteClientUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(users)
    .where(eq(users.id, userId));
}

/**
 * 根據 userId 取得使用者資訊
 */
export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result[0] || null;
}

// ============ PayrollSettlements (月結結算確認) ============

/**
 * 查詢指定員工指定月份的結算狀態
 */
export async function getPayrollSettlement(workerId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(payrollSettlements)
    .where(and(
      eq(payrollSettlements.workerId, workerId),
      eq(payrollSettlements.year, year),
      eq(payrollSettlements.month, month),
    ))
    .limit(1);
  return result[0] || null;
}

/**
 * 批次查詢多位員工指定月份的結算狀態（用於月結報表）
 */
export async function getPayrollSettlementsByMonth(year: number, month: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(payrollSettlements)
    .where(and(
      eq(payrollSettlements.year, year),
      eq(payrollSettlements.month, month),
    ));
}

/**
 * 建立月結結算記錄（鎖定）
 */
export async function createPayrollSettlement(data: {
  workerId: number;
  year: number;
  month: number;
  totalAmount?: number;
  totalHours?: number;
  assignmentCount?: number;
  settledBy?: number;
  note?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(payrollSettlements).values({
    workerId: data.workerId,
    year: data.year,
    month: data.month,
    totalAmount: data.totalAmount ?? null,
    totalHours: data.totalHours ?? null,
    assignmentCount: data.assignmentCount ?? null,
    settledBy: data.settledBy ?? null,
    note: data.note ?? null,
  });
  return await getPayrollSettlement(data.workerId, data.year, data.month);
}

/**
 * 刪除月結結算記錄（解鎖）
 */
export async function deletePayrollSettlement(workerId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(payrollSettlements)
    .where(and(
      eq(payrollSettlements.workerId, workerId),
      eq(payrollSettlements.year, year),
      eq(payrollSettlements.month, month),
    ));
}
