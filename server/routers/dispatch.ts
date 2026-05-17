/**
 * server/routers/dispatch.ts — 快速配對 Router
 *
 * 提供兩個核心 procedure：
 *   dispatch.getMatchingDemands  — 員工視角：查詢某員工在指定日期範圍內可配對的需求單
 *   dispatch.getMatchingWorkers  — 需求視角：查詢某需求單可配對的員工（複用 feasibilityWithAll 邏輯）
 *   dispatch.listOpenDemands     — 需求視角左側：列出指定日期範圍內未滿員的需求單
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import * as logic from "../businessLogic";

// ─── helpers ─────────────────────────────────────────────────────────────────

/** 將 "YYYY-MM-DD" 字串轉換為 UTC 00:00:00 的 Date（與 demands.date 儲存格式一致） */
function dateStrToUtc(str: string): Date {
  return new Date(str + "T00:00:00Z");
}

/** 取得本週週一的台灣日期字串（YYYY-MM-DD） */
function getTaiwanWeekStartStr(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000); // 台灣時間
  const day = now.getUTCDay(); // 0=週日
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() + diff);
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const d = String(monday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 取得 N 天後的台灣日期字串 */
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const dispatchRouter = router({
  /**
   * 員工視角：查詢某員工在指定日期範圍內可配對的需求單
   * 配對條件：
   *   1. 需求單狀態不為 cancelled / closed
   *   2. 需求單尚未滿員（assignedCount < requiredWorkers）
   *   3. 員工在該日期的可排班時段涵蓋需求時段（checkWorkerAvailability）
   *   4. 員工在該時段無指派衝突（checkWorkerConflicts）
   *   5. 工作種類軟性比對（需求有設定種類時，員工需有對應種類）
   */
  getMatchingDemands: publicProcedure
    .input(z.object({
      workerId: z.number(),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),   // YYYY-MM-DD
    }))
    .query(async ({ input }) => {
      const worker = await db.getWorkerById(input.workerId);
      if (!worker) throw new Error("員工不存在");

      // 預設日期範圍：本週（週一 ~ 週日）
      const weekStart = getTaiwanWeekStartStr();
      const dateFrom = input.dateFrom ?? weekStart;
      const dateTo = input.dateTo ?? addDays(weekStart, 6);

      // 取得日期範圍內所有非取消/結案的需求單
      const allDemands = await db.getAllDemands();
      const fromDate = dateStrToUtc(dateFrom);
      const toDate = new Date(dateTo + "T23:59:59Z");

      const rangedDemands = allDemands.filter((d) => {
        if (!d.date) return false;
        const demandDate = new Date(d.date);
        if (demandDate < fromDate || demandDate > toDate) return false;
        if (d.status === "cancelled" || d.status === "closed") return false;
        return true;
      });

      // 取得員工的工作種類
      const workerCategories = await db.getWorkerJobCategories(input.workerId);
      const workerCategoryIds = new Set(workerCategories.map((c) => c.id));

      // 取得員工在該需求單的現有指派（避免重複指派）
      const existingAssignments = await db.getAssignmentsByWorker(input.workerId);
      const alreadyAssignedDemandIds = new Set(
        existingAssignments
          .filter((a) => a.status !== "cancelled")
          .map((a) => a.demandId)
      );

      // 取得所有工作種類（用於顯示）
      const allCategories = await db.getAllJobCategories();
      const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

      // 對每張需求單做配對評估
      const results = await Promise.all(
        rangedDemands.map(async (demand) => {
          const demandDate = new Date(demand.date);
          const assignedCount = demand.assignedCount ?? 0;
          const shortage = demand.requiredWorkers - assignedCount;

          // 工作種類軟性比對
          let categoryMatch: "matched" | "unset" | "mismatch" = "unset";
          const category = demand.jobCategoryId ? categoryMap.get(demand.jobCategoryId) : null;
          if (demand.jobCategoryId) {
            categoryMatch = workerCategoryIds.has(demand.jobCategoryId) ? "matched" : "mismatch";
          }

          // 已指派此需求單
          const alreadyAssigned = alreadyAssignedDemandIds.has(demand.id);

          // 可排班時段檢查
          const availabilityCheck = await logic.checkWorkerAvailability(
            input.workerId,
            demandDate,
            demand.startTime,
            demand.endTime
          );

          // 時段衝突檢查
          const scheduledStart = logic.combineDateAndTime(demandDate, demand.startTime);
          const scheduledEnd = logic.combineDateAndTime(demandDate, demand.endTime);
          const conflicts = await logic.checkWorkerConflicts(
            input.workerId,
            scheduledStart,
            scheduledEnd
          );
          const hasConflict = conflicts.length > 0;

          // 判斷配對狀態
          let matchStatus: "available" | "assigned" | "conflict" | "unavailable" | "mismatch";
          let matchReason = "";

          if (alreadyAssigned) {
            matchStatus = "assigned";
            matchReason = "已指派此需求單";
          } else if (hasConflict) {
            matchStatus = "conflict";
            matchReason = "時段衝突：已有其他指派";
          } else if (!availabilityCheck.available) {
            matchStatus = "unavailable";
            matchReason = availabilityCheck.reason ?? "不在可排班時段";
          } else if (categoryMatch === "mismatch") {
            matchStatus = "mismatch";
            matchReason = `工作種類不符（需求：${category?.name ?? "未知"}）`;
          } else if (shortage <= 0) {
            matchStatus = "unavailable";
            matchReason = "需求已滿員";
          } else {
            matchStatus = "available";
          }

          return {
            demand: {
              ...demand,
              jobCategory: category ?? null,
            },
            matchStatus,
            matchReason,
            shortage,
            categoryMatch,
            scheduledStart,
            scheduledEnd,
          };
        })
      );

      // 排序：可配對 → 種類不符 → 時段不符 → 衝突 → 已指派；同組內按日期升序
      const order: Record<string, number> = {
        available: 0,
        mismatch: 1,
        unavailable: 2,
        conflict: 3,
        assigned: 4,
      };
      results.sort((a, b) => {
        const oa = order[a.matchStatus] ?? 9;
        const ob = order[b.matchStatus] ?? 9;
        if (oa !== ob) return oa - ob;
        return new Date(a.demand.date).getTime() - new Date(b.demand.date).getTime();
      });

      return {
        worker,
        workerCategories,
        results,
        dateFrom,
        dateTo,
      };
    }),

  /**
   * 需求視角：查詢某需求單可配對的員工
   * 直接複用 calculateDemandFeasibilityWithAll（含工作許可、衝突、吻合度排序）
   * 並附加工作種類比對資訊
   */
  getMatchingWorkers: publicProcedure
    .input(z.object({
      demandId: z.number(),
    }))
    .query(async ({ input }) => {
      // 使用 getAllDemands 以取得含 client 物件的完整資料
      const allDemands = await db.getAllDemands();
      const demand = allDemands.find((d) => d.id === input.demandId);
      if (!demand) throw new Error("需求單不存在");

      const demandDate = new Date(demand.date);

      // 複用現有完整可行性計算
      const feasibility = await logic.calculateDemandFeasibilityWithAll(
        input.demandId,
        demandDate,
        demand.startTime,
        demand.endTime,
        demand.requiredWorkers
      );

      // 工作種類比對：取得所有員工的工作種類 Map
      let workerCategoryMap: Record<number, number[]> = {};
      let demandCategory = null;
      if (demand.jobCategoryId) {
        workerCategoryMap = await db.getWorkerCategoryMap();
        const allCats = await db.getAllJobCategories();
        demandCategory = allCats.find((c) => c.id === demand.jobCategoryId) ?? null;
      }

      // 為每個員工附加工作種類比對結果
      const enrichWorker = (worker: any) => {
        const categoryIds = workerCategoryMap[worker.id] ?? [];
        const categoryMatch = demand.jobCategoryId
          ? categoryIds.includes(demand.jobCategoryId) ? "matched" : "mismatch"
          : "unset";
        return { ...worker, categoryMatch };
      };

      return {
        demand: {
          ...demand,
          jobCategory: demandCategory,
        },
        availableWorkers: feasibility.availableWorkers.map(enrichWorker),
        schedulableWorkers: feasibility.schedulableWorkers.map((w: any) => ({
          ...w,
          worker: enrichWorker(w.worker),
        })),
        conflictWorkers: feasibility.conflictWorkers.map((w: any) => ({
          ...w,
          worker: enrichWorker(w.worker),
        })),
        shortage: feasibility.shortage,
        assignedCount: (demand.requiredWorkers - feasibility.shortage),
      };
    }),

  /**
   * 需求視角左側：列出指定日期範圍內未滿員（或全部）的需求單
   */
  listOpenDemands: publicProcedure
    .input(z.object({
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      onlyShortage: z.boolean().default(true), // 預設只顯示缺員需求
      jobCategoryId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const weekStart = getTaiwanWeekStartStr();
      const dateFrom = input.dateFrom ?? weekStart;
      const dateTo = input.dateTo ?? addDays(weekStart, 6);

      const allDemands = await db.getAllDemands();
      const fromDate = dateStrToUtc(dateFrom);
      const toDate = new Date(dateTo + "T23:59:59Z");

      // 取得所有工作種類
      const allCategories = await db.getAllJobCategories();
      const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

      const filtered = allDemands
        .filter((d) => {
          if (!d.date) return false;
          const demandDate = new Date(d.date);
          if (demandDate < fromDate || demandDate > toDate) return false;
          if (d.status === "cancelled" || d.status === "closed") return false;
          if (input.onlyShortage) {
            const shortage = d.requiredWorkers - (d.assignedCount ?? 0);
            if (shortage <= 0) return false;
          }
          if (input.jobCategoryId && d.jobCategoryId !== input.jobCategoryId) return false;
          return true;
        })
        .map((d) => ({
          ...d,
          shortage: d.requiredWorkers - (d.assignedCount ?? 0),
          jobCategory: d.jobCategoryId ? (categoryMap.get(d.jobCategoryId) ?? null) : null,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return { demands: filtered, dateFrom, dateTo };
    }),
});
