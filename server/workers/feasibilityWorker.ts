/**
 * server/workers/feasibilityWorker.ts
 *
 * Worker Thread 腳本：負責純 CPU 密集的吻合度計算與排序。
 * 不依賴 DB 連線，所有資料由主執行緒序列化後透過 workerData 傳入。
 *
 * 架構說明：
 *   主執行緒負責 DB 查詢（getAllWorkers、getAssignments、getAvailability 等），
 *   將原始資料打包為 FeasibilityInput 後傳給本 Worker Thread。
 *   Worker Thread 執行吻合度計算、衝突判斷、排序，回傳 FeasibilityOutput。
 *
 * 效能說明：
 *   - 將 O(N×M) 的 CPU 計算（N 員工 × M 時段比對）從主執行緒卸載
 *   - 避免在高並發時阻塞 Node.js event loop
 *   - 適合員工規模 50 人以上的場景
 */

import { workerData, parentPort } from "worker_threads";

// ─── 型別定義（與主執行緒共用，不依賴 Drizzle schema）────────────────────────

export interface TimeSlot {
  startTime: string;
  endTime: string;
}

export interface TimeBlock {
  dayOfWeek: number;
  startTime?: string;
  endTime?: string;
  timeSlots?: TimeSlot[];
}

export interface WorkerRow {
  id: number;
  name: string;
  status: string;
  hasWorkPermit: boolean | null;
  workPermitExpiryDate: number | null; // UTC timestamp (ms)
  weekHours: number;
  last7DaysCount: number;
}

export interface AssignmentRow {
  id: number;
  demandId: number;
  workerId: number;
  scheduledStart: number; // UTC timestamp (ms)
  scheduledEnd: number;   // UTC timestamp (ms)
  status: string;
  scheduledHours: number | null;
}

export interface AvailabilityRow {
  workerId: number;
  confirmedAt: number | null; // UTC timestamp (ms) or null
  timeBlocks: string;         // JSON string
}

export interface DemandRow {
  id: number;
  status: string;
  clientId: number;
  clientName: string;
}

/** 主執行緒傳入的輸入資料 */
export interface FeasibilityInput {
  demandId: number;
  demandDate: number;   // UTC timestamp (ms)
  startTime: string;    // HH:mm
  endTime: string;      // HH:mm
  requiredWorkers: number;
  workers: WorkerRow[];
  /** 每個員工當天的 assignments（key = workerId） */
  dayAssignmentsByWorker: Record<number, AssignmentRow[]>;
  /** 每個員工的 availability（key = workerId） */
  availabilityByWorker: Record<number, AvailabilityRow | null>;
  /** demandId → { status, clientName } */
  demandsInfo: Record<number, DemandRow>;
}

/** Worker Thread 回傳的輸出資料 */
export interface FeasibilityOutput {
  availableWorkers: (WorkerRow & { weekHours: number; last7DaysCount: number })[];
  schedulableWorkers: Array<{
    worker: WorkerRow;
    reasons: string[];
    fitScore: number;
    fitLabel: string;
    fitDetail?: string;
    isConflict: boolean;
  }>;
  conflictWorkers: Array<{
    worker: WorkerRow;
    reasons: string[];
    fitScore: number;
    fitLabel: string;
    fitDetail?: string;
    isConflict: boolean;
  }>;
  shortage: number;
}

// ─── 純計算工具函式（不依賴任何外部模組）────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function isTimeOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  return s1 < e2 && s2 < e1;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function combineDateAndTime(dateTs: number, time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  const d = new Date(dateTs);
  d.setUTCHours(hours, minutes, 0, 0);
  return d.getTime();
}

function parseTimeBlocks(json: string): TimeBlock[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

/**
 * 計算員工對需求的排班吻合度分數（純 CPU，不查 DB）
 */
function calcFitScore(
  avail: AvailabilityRow | null,
  demandDate: number,
  startTime: string,
  endTime: string,
  hasConflict: boolean
): { score: number; fitLabel: string; fitDetail?: string } {
  if (hasConflict) {
    return { score: 0, fitLabel: "排班衝突", fitDetail: "該時段已有其他指派" };
  }

  if (!avail || !avail.confirmedAt) {
    return { score: 0, fitLabel: "無排班設定", fitDetail: "本週排班時間未設定或未確認" };
  }

  const timeBlocks = parseTimeBlocks(avail.timeBlocks);
  const demandDateObj = new Date(demandDate);
  const dayOfWeek = demandDateObj.getUTCDay() === 0 ? 7 : demandDateObj.getUTCDay();
  const demandStart = timeToMinutes(startTime);
  const demandEnd = timeToMinutes(endTime);
  const demandDuration = demandEnd - demandStart;

  const dayBlocks = timeBlocks.filter((b) => b.dayOfWeek === dayOfWeek);

  if (dayBlocks.length > 0) {
    let maxOverlapMinutes = 0;
    for (const block of dayBlocks) {
      const slots: TimeSlot[] =
        block.timeSlots && Array.isArray(block.timeSlots)
          ? block.timeSlots
          : block.startTime && block.endTime
          ? [{ startTime: block.startTime, endTime: block.endTime }]
          : [];

      for (const slot of slots) {
        const slotStart = timeToMinutes(slot.startTime);
        const slotEnd = timeToMinutes(slot.endTime);
        const overlapStart = Math.max(demandStart, slotStart);
        const overlapEnd = Math.min(demandEnd, slotEnd);
        const overlap = Math.max(0, overlapEnd - overlapStart);
        maxOverlapMinutes = Math.max(maxOverlapMinutes, overlap);
      }
    }

    if (demandDuration > 0 && maxOverlapMinutes >= demandDuration) {
      return { score: 85, fitLabel: "時段接近", fitDetail: "排班時段完全覆蓋需求" };
    } else if (maxOverlapMinutes > 0) {
      const overlapPct = Math.round((maxOverlapMinutes / demandDuration) * 100);
      const score = 50 + Math.round(overlapPct * 0.35);
      return {
        score,
        fitLabel: "部分重疊",
        fitDetail: `排班時段與需求重疊 ${maxOverlapMinutes} 分鐘（${overlapPct}%）`,
      };
    } else {
      return { score: 30, fitLabel: "同日有排班", fitDetail: "同日有排班但時段不重疊" };
    }
  }

  if (timeBlocks.length > 0) {
    return { score: 10, fitLabel: "本週有排班", fitDetail: "本週有排班，但非需求當日" };
  }

  return { score: 0, fitLabel: "無排班設定", fitDetail: "本週無任何排班設定" };
}

/**
 * 檢查員工是否在可排班時段內（純 CPU）
 */
function checkAvailability(
  avail: AvailabilityRow | null,
  demandDate: number,
  startTime: string,
  endTime: string
): { available: boolean; reason?: string; availableTimeBlocks?: string } {
  if (!avail) {
    return { available: false, reason: "本週排班時間設置未設定" };
  }
  if (!avail.confirmedAt) {
    return { available: false, reason: "本週排班時間設置未確認" };
  }

  const timeBlocks = parseTimeBlocks(avail.timeBlocks);
  const demandDateObj = new Date(demandDate);
  const dayOfWeek = demandDateObj.getUTCDay() === 0 ? 7 : demandDateObj.getUTCDay();
  const dayBlocks = timeBlocks.filter((b) => b.dayOfWeek === dayOfWeek);

  if (dayBlocks.length === 0) {
    return { available: false, reason: "該日無可排班時段" };
  }

  const demandStartMin = timeToMinutes(startTime);
  const demandEndMin = timeToMinutes(endTime);

  const covered = dayBlocks.some((block) => {
    const slots: TimeSlot[] =
      block.timeSlots && Array.isArray(block.timeSlots)
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

  if (!covered) {
    return { available: false, reason: "不在可排班時段" };
  }

  return { available: true };
}

// ─── 主計算邏輯 ──────────────────────────────────────────────────────────────

export function compute(input: FeasibilityInput): FeasibilityOutput {
  const {
    demandId,
    demandDate,
    startTime,
    endTime,
    requiredWorkers,
    workers,
    dayAssignmentsByWorker,
    availabilityByWorker,
    demandsInfo,
  } = input;

  const scheduledStart = combineDateAndTime(demandDate, startTime);
  const scheduledEnd = combineDateAndTime(demandDate, endTime);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayTs = today.getTime();

  const availableWorkers: FeasibilityOutput["availableWorkers"] = [];
  const unavailableWithScore: FeasibilityOutput["schedulableWorkers"] = [];

  for (const worker of workers) {
    const reasons: string[] = [];

    // 1. 排班時間設置檢查
    const avail = availabilityByWorker[worker.id] ?? null;
    const availCheck = checkAvailability(avail, demandDate, startTime, endTime);
    if (!availCheck.available) {
      reasons.push(availCheck.reason ?? "不在可排班時段");
    }

    // 2. 時段衝突檢查
    const dayAssignments = dayAssignmentsByWorker[worker.id] ?? [];
    const activeAssignments = dayAssignments.filter((a) => {
      if (a.status === "cancelled") return false;
      if (a.demandId === demandId) return false;
      const demandInfo = demandsInfo[a.demandId];
      if (demandInfo && demandInfo.status === "cancelled") return false;
      return true;
    });

    for (const assignment of activeAssignments) {
      if (
        isTimeOverlap(
          assignment.scheduledStart,
          assignment.scheduledEnd,
          scheduledStart,
          scheduledEnd
        )
      ) {
        const demandInfo = demandsInfo[assignment.demandId];
        const clientName = demandInfo?.clientName ?? "未知客戶";
        const timeStr = `${formatTime(assignment.scheduledStart)}-${formatTime(assignment.scheduledEnd)}`;
        reasons.push(`排班衝突：${clientName} ${timeStr}`);
      }
    }

    // 3. 工作許可過期檢查
    if (worker.hasWorkPermit && worker.workPermitExpiryDate) {
      if (worker.workPermitExpiryDate < todayTs) {
        const expiryDate = new Date(worker.workPermitExpiryDate);
        const expiryStr = `${expiryDate.getUTCFullYear()}/${String(expiryDate.getUTCMonth() + 1).padStart(2, "0")}/${String(expiryDate.getUTCDate()).padStart(2, "0")}`;
        reasons.push(`PERMIT_EXPIRED:工作許可已於 ${expiryStr} 過期`);
      }
    }

    if (reasons.length === 0) {
      availableWorkers.push(worker);
    } else {
      const hasConflict = reasons.some((r) => r.startsWith("排班衝突"));
      const fit = calcFitScore(avail, demandDate, startTime, endTime, hasConflict);
      const isExpiredPermitOnly =
        reasons.length > 0 && reasons.every((r) => r.startsWith("PERMIT_EXPIRED:"));
      unavailableWithScore.push({
        worker,
        reasons,
        fitScore: fit.score,
        fitLabel: fit.fitLabel,
        fitDetail: fit.fitDetail,
        isConflict: hasConflict,
        ...(isExpiredPermitOnly ? { isExpiredPermitOnly: true } : {}),
      } as FeasibilityOutput["schedulableWorkers"][number]);
    }
  }

  // 排序 availableWorkers：本週工時少 → 近 7 天排班少 → 姓名
  availableWorkers.sort((a, b) => {
    if (a.weekHours !== b.weekHours) return a.weekHours - b.weekHours;
    if (a.last7DaysCount !== b.last7DaysCount) return a.last7DaysCount - b.last7DaysCount;
    return a.name.localeCompare(b.name, "zh-TW");
  });

  const schedulableWorkers = unavailableWithScore
    .filter((w) => !w.isConflict)
    .sort((a, b) => b.fitScore - a.fitScore || a.worker.name.localeCompare(b.worker.name, "zh-TW"));

  const conflictWorkers = unavailableWithScore
    .filter((w) => w.isConflict)
    .sort((a, b) => a.worker.name.localeCompare(b.worker.name, "zh-TW"));

  const shortage = Math.max(0, requiredWorkers - availableWorkers.length);

  return { availableWorkers, schedulableWorkers, conflictWorkers, shortage };
}

// ─── Worker Thread 入口 ──────────────────────────────────────────────────────

if (parentPort) {
  // 接收主執行緒傳入的資料，計算後回傳結果
  const input = workerData as FeasibilityInput;
  try {
    const result = compute(input);
    parentPort.postMessage({ ok: true, result });
  } catch (err) {
    parentPort.postMessage({ ok: false, error: String(err) });
  }
}
