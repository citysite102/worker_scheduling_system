import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "client"]).default("user").notNull(),
  clientId: int("clientId"),
  position: varchar("position", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  password: varchar("password", { length: 255 }), // 加密後的密碼（僅用於 client 角色）
  passwordResetToken: varchar("passwordResetToken", { length: 255 }), // 重設密碼 token
  passwordResetExpires: timestamp("passwordResetExpires"), // token 過期時間
  mustChangePassword: int("mustChangePassword").default(0).notNull(), // 0=不需要, 1=首次登入必須修改密碼
  onboardingCompleted: int("onboardingCompleted").default(0).notNull(), // 0=未完成 Onboarding, 1=已完成
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Workers (員工) - 員工基本資料
 */
export const workers = mysqlTable("workers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  school: varchar("school", { length: 200 }),
  nationality: varchar("nationality", { length: 100 }), // 國籍
  idNumber: varchar("idNumber", { length: 50 }), // 統一證號
  hasWorkPermit: int("hasWorkPermit").default(0).notNull(), // 0=無, 1=有工作簽證
  hasHealthCheck: int("hasHealthCheck").default(0).notNull(), // 0=無, 1=有體檢
  workPermitExpiryDate: timestamp("workPermitExpiryDate"), // 工作許可到期日，可為 null 表示無期限
  attendanceNotes: text("attendanceNotes"), // 出勤備註（遲到/曠職記錄）
  lineId: varchar("lineId", { length: 100 }), // Line ID（選填）
  whatsappId: varchar("whatsappId", { length: 100 }), // WhatsApp ID（選填）
  avatarUrl: text("avatarUrl"), // 頭像 URL（可為自訂上傳或預設頭像）
  city: varchar("city", { length: 50 }), // 所在縣市
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Worker = typeof workers.$inferSelect;
export type InsertWorker = typeof workers.$inferInsert;

/**
 * Clients (客戶) - 客戶基本資料
 */
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  clientCode: varchar("clientCode", { length: 50 }).notNull().unique(), // 客戶唯一識別碼（例如：CLI-20260225-001）
  name: varchar("name", { length: 200 }).notNull(),
  contactName: varchar("contactName", { length: 100 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 20 }),
  address: text("address"),
  logoUrl: text("logoUrl"), // 客戶 Logo URL
  billingType: mysqlEnum("billingType", ["hourly", "fixed", "custom"]).default("hourly").notNull(),
  note: text("note"),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

/**
 * Availability (排班時間設置) - 員工每週可排班時段（滾動更新）
 * timeBlocks 儲存為 JSON 格式：[{dayOfWeek: 1-7, startTime: "HH:mm", endTime: "HH:mm"}]
 */
export const availability = mysqlTable("availability", {
  id: int("id").autoincrement().primaryKey(),
  workerId: int("workerId").notNull().references(() => workers.id),
  weekStartDate: timestamp("weekStartDate").notNull(), // 週一日期
  weekEndDate: timestamp("weekEndDate").notNull(), // 週日日期
  timeBlocks: text("timeBlocks").notNull(), // JSON array
  confirmedAt: timestamp("confirmedAt"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Availability = typeof availability.$inferSelect;
export type InsertAvailability = typeof availability.$inferInsert;

/**
 * Demands (用工需求) - 客戶提出的用工需求
 */
export const demands = mysqlTable("demands", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id),
  date: timestamp("date").notNull(), // 需求日期
  startTime: varchar("startTime", { length: 5 }).notNull(), // HH:mm
  endTime: varchar("endTime", { length: 5 }).notNull(), // HH:mm
  requiredWorkers: int("requiredWorkers").notNull(),
  breakHours: int("breakHours").default(0).notNull(), // 休息時間（以分鐘為單位，預設 0）
  demandTypeId: int("demandTypeId").references(() => demandTypes.id), // 需求類型 ID（可為 null）
  selectedOptions: text("selectedOptions"), // 已勾選的選項 ID（JSON 陣列，例如："[1,3,5]"）
  location: varchar("location", { length: 200 }),
  note: text("note"),
  status: mysqlEnum("status", ["draft", "pending", "confirmed", "assigned", "completed", "cancelled", "closed"]).default("draft").notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Demand = typeof demands.$inferSelect;
export type InsertDemand = typeof demands.$inferInsert;

/**
 * Assignments (排班指派) - 將員工指派至需求單
 */
export const assignments = mysqlTable("assignments", {
  id: int("id").autoincrement().primaryKey(),
  demandId: int("demandId").notNull().references(() => demands.id),
  workerId: int("workerId").notNull().references(() => workers.id),
  scheduledStart: timestamp("scheduledStart").notNull(),
  scheduledEnd: timestamp("scheduledEnd").notNull(),
  actualStart: timestamp("actualStart"),
  actualEnd: timestamp("actualEnd"),
  scheduledHours: int("scheduledHours").notNull(), // 以分鐘為單位儲存，避免浮點數問題
  actualHours: int("actualHours"), // 以分鐘為單位
  varianceHours: int("varianceHours"), // 以分鐘為單位
  status: mysqlEnum("status", ["assigned", "completed", "cancelled", "disputed"]).default("assigned").notNull(),
  role: mysqlEnum("role", ["regular", "intern"]).default("regular").notNull(), // 正職 or 實習生
  // 薪資計算欄位（與客戶計費完全分離）
  payType: mysqlEnum("payType", ["hourly", "unit", "fixed"]).default("hourly"), // 計薪方式：時薪/件薪/固定
  unitCount: int("unitCount"), // 完成件數（如：整理 10 間房）
  unitType: varchar("unitType", { length: 50 }), // 件數單位（如：「間」、「件」、「箱」）
  payRate: int("payRate"), // 計薪單價（元/小時 或 元/件），以整數儲存（元）
  payAmount: int("payAmount"), // 最終薪資金額（元），計算後存入方便報表
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Assignment = typeof assignments.$inferSelect;
export type InsertAssignment = typeof assignments.$inferInsert;

/**
 * DemandTypes (需求類型) - 用工需求的類型分類
 */
export const demandTypes = mysqlTable("demandTypes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // 需求名稱（例如：櫃檯接待服務）
  description: text("description"), // 需求說明
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DemandType = typeof demandTypes.$inferSelect;
export type InsertDemandType = typeof demandTypes.$inferInsert;

/**
 * DemandTypeOptions (需求類型選項) - 每個需求類型的可選項目
 */
export const demandTypeOptions = mysqlTable("demandTypeOptions", {
  id: int("id").autoincrement().primaryKey(),
  demandTypeId: int("demandTypeId").notNull().references(() => demandTypes.id),
  content: text("content").notNull(), // 選項內容（例如：以專業、熱情及友善的態度接待顧客）
  sortOrder: int("sortOrder").default(0).notNull(), // 排序順序
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DemandTypeOption = typeof demandTypeOptions.$inferSelect;
export type InsertDemandTypeOption = typeof demandTypeOptions.$inferInsert;

/**
 * Admins (管理員) - 管理員邀請與權限管理碼管理
 */
export const adminInvites = mysqlTable("admin_invites", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  createdBy: int("createdBy").notNull().references(() => users.id),
  usedBy: int("usedBy").references(() => users.id),
  usedAt: timestamp("usedAt"),
  expiresAt: timestamp("expiresAt"),
  status: mysqlEnum("status", ["active", "used", "expired", "revoked"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminInvite = typeof adminInvites.$inferSelect;
export type InsertAdminInvite = typeof adminInvites.$inferInsert;

/**
 * PayrollSettlements (月結結算確認) - 管理員對員工某月薪資進行鎖定結算
 * 一旦結算，該月份的薪資資料不可再修改（需解鎖才能重新填寫）
 */
export const payrollSettlements = mysqlTable("payroll_settlements", {
  id: int("id").autoincrement().primaryKey(),
  workerId: int("workerId").notNull().references(() => workers.id),
  year: int("year").notNull(),           // 結算年份（例如：2026）
  month: int("month").notNull(),          // 結算月份（1-12）
  totalAmount: int("totalAmount"),        // 結算總金額（元），可為 null（若有待填項目）
  totalHours: int("totalHours"),          // 結算總工時（分鐘）
  assignmentCount: int("assignmentCount"), // 結算指派筆數
  settledBy: int("settledBy").references(() => users.id), // 執行結算的管理員 userId
  settledAt: timestamp("settledAt").defaultNow().notNull(), // 結算時間
  note: text("note"),                     // 結算備註
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PayrollSettlement = typeof payrollSettlements.$inferSelect;
export type InsertPayrollSettlement = typeof payrollSettlements.$inferInsert;