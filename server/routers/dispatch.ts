/**
 * server/routers/dispatch.ts — 快速配對 Router
 *
 * 提供三個核心 procedure：
 *   dispatch.getMatchingDemands  — 員工視角：查詢某員工在指定日期範圍內可配對的需求單
 *   dispatch.getMatchingWorkers  — 需求視角：查詢某需求單可配對的員工（複用 feasibilityWithAll 邏輯）
 *   dispatch.listOpenDemands     — 需求視角左側：列出指定日期範圍內未滿員的需求單
 *
 * 效能優化（方案A + 方案B）：
 *   - 方案B：getAllDemands 加入 dateFrom/dateTo SQL 層過濾，不再全表載入後 JS 過濾
 *   - 方案A：getMatchingDemands 批次預載入 availability 和 assignments，消除 N+1 查詢
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

/** 將時間字串轉換為分鐘數 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const dispatchRouter = router({
  /**
   * 員工視角：查詢某員工在指定日期範圍內可配對的需求單
   *
   * 效能優化（方案A）：
   *   - 一次查出員工在整個日期範圍的所有 assignments（1 次 DB）
   *   - 一次查出員工在所有相關週次的 availability（1 次 DB per week，最多 2 次）
   *   - 在記憶體中做時段比對，不再對每張需求單各自查 DB
   */
  getMatchingDemands: publicProcedure
    .input(z.object({
      workerId: z.number(),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }))
    .query(async ({ input }) => {
      const worker = await db.getWorkerById(input.workerId);
      if (!worker) throw new Error("員工不存在");

      // 預設日期範圍：本週（週一 ~ 週日）
      const weekStart = getTaiwanWeekStartStr();
      const dateFrom = input.dateFrom ?? weekStart;
      const dateTo = input.dateTo ?? addDays(weekStart, 6);

      const fromDate = dateStrToUtc(dateFrom);
      const toDate = new Date(dateTo + "T23:59:59Z");

      // ── 方案B：SQL 層日期過濾，只取指定範圍內的需求單 ──
      const rangedDemands = (await db.getAllDemands(
        undefined, undefined, undefined, fromDate, toDate
      )).filter((d) => d.status !== "cancelled" && d.status !== "closed");

      // ── 方案A：批次預載入 1 — 員工在整個日期範圍的所有 assignments ──
      const workerAssignments = await db.getAssignmentsByWorker(
        input.workerId,
        fromDate,
        toDate
      );
      const activeAssignmentsByDate = new Map<string, typeof workerAssignments>();
      for (const a of workerAssignments) {
        if (a.status === "cancelled") continue;
        const dateKey = new Date(a.scheduledStart).toISOString().split("T")[0];
        if (!activeAssignmentsByDate.has(dateKey)) activeAssignmentsByDate.set(dateKey, []);
        activeAssignmentsByDate.get(dateKey)!.push(a);
      }

      // 已指派的需求單 ID（避免重複指派）
      const alreadyAssignedDemandIds = new Set(
        workerAssignments.filter((a) => a.status !== "cancelled").map((a) => a.demandId)
      );

      // ── 方案A：批次預載入 2 — 員工在所有相關週次的 availability ──
      // 收集日期範圍內所有不重複的週一
      const weekStartDates = new Map<string, Date>();
      for (const demand of rangedDemands) {
        const demandDate = new Date(demand.date);
        const ws = logic.getWeekStart(demandDate);
        const key = ws.toISOString();
        if (!weekStartDates.has(key)) weekStartDates.set(key, ws);
      }

      // 每個週次一次查詢（通常只有 1-2 週）
      const availabilityByWeek = new Map<string, ReturnType<typeof db.getAvailabilityByWorkerAndWeek> extends Promise<infer T> ? T : never>();
      await Promise.all(
        Array.from(weekStartDates.entries()).map(async ([key, ws]) => {
          const avail = await db.getAvailabilityByWorkerAndWeek(input.workerId, ws);
          availabilityByWeek.set(key, avail);
        })
      );

      // 工作種類資料（dedup：防禦 DB 中可能存在的重複關聯記錄）
      const rawWorkerCategories = await db.getWorkerJobCategories(input.workerId);
      const seenCatIds = new Set<number>();
      const workerCategories = rawWorkerCategories.filter((c) => {
        if (seenCatIds.has(c.id)) return false;
        seenCatIds.add(c.id);
        return true;
      });
      const workerCategoryIds = seenCatIds;
      const allCategories = await db.getAllJobCategories();
      const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

      // ── 在記憶體中做配對評估（不再觸發 DB 查詢）──
      const results = rangedDemands.map((demand) => {
        const demandDate = new Date(demand.date);
        const assignedCount = demand.assignedCount ?? 0;
        const shortage = demand.requiredWorkers - assignedCount;

        // 工作種類軟性比對
        const category = demand.jobCategoryId ? categoryMap.get(demand.jobCategoryId) : null;
        let categoryMatch: "matched" | "unset" | "mismatch" = "unset";
        if (demand.jobCategoryId) {
          categoryMatch = workerCategoryIds.has(demand.jobCategoryId) ? "matched" : "mismatch";
        }

        // 已指派此需求單
        const alreadyAssigned = alreadyAssignedDemandIds.has(demand.id);

        // ── 從預載入的 availability Map 中取得排班資料 ──
        const ws = logic.getWeekStart(demandDate);
        const avail = availabilityByWeek.get(ws.toISOString());

        let availabilityOk = false;
        let availabilityReason = "本週排班時間設置未設定";

        if (avail && avail.confirmedAt) {
          let timeBlocks: Array<{
            dayOfWeek: number;
            startTime?: string;
            endTime?: string;
            timeSlots?: Array<{ startTime: string; endTime: string }>;
          }> = [];
          try { timeBlocks = JSON.parse(avail.timeBlocks); } catch { /* ignore */ }

          const dayOfWeek = demandDate.getUTCDay() === 0 ? 7 : demandDate.getUTCDay();
          const dayBlocks = timeBlocks.filter((b) => b.dayOfWeek === dayOfWeek);

          if (dayBlocks.length === 0) {
            availabilityReason = "該日無可排班時段";
          } else {
            const demandStartMin = timeToMinutes(demand.startTime);
            const demandEndMin = timeToMinutes(demand.endTime);
            const covered = dayBlocks.some((block) => {
              const slots = block.timeSlots && Array.isArray(block.timeSlots)
                ? block.timeSlots
                : block.startTime && block.endTime
                  ? [{ startTime: block.startTime, endTime: block.endTime }]
                  : [];
              return slots.some(
                (s) =>
                  timeToMinutes(s.startTime) <= demandStartMin &&
                  timeToMinutes(s.endTime) >= demandEndMin
              );
            });
            if (covered) {
              availabilityOk = true;
            } else {
              availabilityReason = "不在可排班時段";
            }
          }
        } else if (avail && !avail.confirmedAt) {
          availabilityReason = "本週排班時間設置未確認";
        }

        // ── 從預載入的 assignments Map 中做衝突檢查 ──
        const dateKey = demandDate.toISOString().split("T")[0];
        const dayAssignments = activeAssignmentsByDate.get(dateKey) ?? [];
        const scheduledStart = logic.combineDateAndTime(demandDate, demand.startTime);
        const scheduledEnd = logic.combineDateAndTime(demandDate, demand.endTime);
        const hasConflict = dayAssignments.some(
          (a) =>
            a.demandId !== demand.id &&
            logic.isTimeOverlap(
              new Date(a.scheduledStart),
              new Date(a.scheduledEnd),
              scheduledStart,
              scheduledEnd
            )
        );

        // 判斷配對狀態
        let matchStatus: "available" | "assigned" | "conflict" | "unavailable" | "mismatch";
        let matchReason = "";

        if (alreadyAssigned) {
          matchStatus = "assigned";
          matchReason = "已指派此需求單";
        } else if (hasConflict) {
          matchStatus = "conflict";
          matchReason = "時段衝突：已有其他指派";
        } else if (!availabilityOk) {
          matchStatus = "unavailable";
          matchReason = availabilityReason;
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
          demand: { ...demand, jobCategory: category ?? null },
          matchStatus,
          matchReason,
          shortage,
          categoryMatch,
          scheduledStart,
          scheduledEnd,
        };
      });

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

      return { worker, workerCategories, results, dateFrom, dateTo };
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
        demand: { ...demand, jobCategory: demandCategory },
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
   * 方案B：使用 SQL 層日期過濾
   */
  listOpenDemands: publicProcedure
    .input(z.object({
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      onlyShortage: z.boolean().default(true),
      jobCategoryId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const weekStart = getTaiwanWeekStartStr();
      const dateFrom = input.dateFrom ?? weekStart;
      const dateTo = input.dateTo ?? addDays(weekStart, 6);

      const fromDate = dateStrToUtc(dateFrom);
      const toDate = new Date(dateTo + "T23:59:59Z");

      // 方案B：SQL 層日期過濾
      const allDemands = await db.getAllDemands(undefined, undefined, undefined, fromDate, toDate);

      // 取得所有工作種類
      const allCategories = await db.getAllJobCategories();
      const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

      const filtered = allDemands
        .filter((d) => {
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
