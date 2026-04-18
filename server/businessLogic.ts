import { getAssignmentsByWorker, getAvailabilityByWorkerAndWeek, getAllWorkers, getAssignmentsByDemand, getClientById, getWorkerById } from "./db";

/**
 * 時段重疊檢查
 * 檢查兩個時段是否重疊
 */
export function isTimeOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * 檢查員工在指定時段是否有排班衝突
 * @returns 衝突的排班記錄陣列
 */
export async function checkWorkerConflicts(
  workerId: number,
  scheduledStart: Date,
  scheduledEnd: Date,
  excludeAssignmentId?: number
) {
  const startDate = new Date(scheduledStart);
  startDate.setUTCHours(0, 0, 0, 0); // 使用 UTC 避免伺服器本地時區影響
  const endDate = new Date(scheduledEnd);
  endDate.setUTCHours(23, 59, 59, 999); // 使用 UTC 避免伺服器本地時區影響

  const existingAssignments = await getAssignmentsByWorker(workerId, startDate, endDate);

  const conflicts = existingAssignments.filter((assignment) => {
    if (excludeAssignmentId && assignment.id === excludeAssignmentId) {
      return false;
    }
    if (assignment.status === "cancelled") {
      return false;
    }
    return isTimeOverlap(
      new Date(assignment.scheduledStart),
      new Date(assignment.scheduledEnd),
      scheduledStart,
      scheduledEnd
    );
  });

  return conflicts;
}

/**
 * 檢查員工是否在可排班時段內
 * @param workerId 員工 ID
 * @param demandDate 需求日期
 * @param startTime 開始時間 (HH:mm)
 * @param endTime 結束時間 (HH:mm)
 * @returns { available: boolean, reason?: string, availableTimeBlocks?: string }
 */
export async function checkWorkerAvailability(
  workerId: number,
  demandDate: Date,
  startTime: string,
  endTime: string
): Promise<{ available: boolean; reason?: string; availableTimeBlocks?: string }> {
  // 取得該週的週一日期
  const weekStartDate = getWeekStart(demandDate);
  
  // 查詢該員工在該週的排班時間設置
  const availability = await getAvailabilityByWorkerAndWeek(workerId, weekStartDate);

  if (!availability) {
    return {
      available: false,
      reason: "本週排班時間設置未設定",
    };
  }

  if (!availability.confirmedAt) {
    return {
      available: false,
      reason: "本週排班時間設置未確認",
    };
  }

  // 解析 timeBlocks（支援新舊格式）
  let timeBlocks: Array<{ dayOfWeek: number; startTime?: string; endTime?: string; timeSlots?: Array<{ startTime: string; endTime: string }> }> = [];
  try {
    timeBlocks = JSON.parse(availability.timeBlocks);
  } catch (error) {
    return {
      available: false,
      reason: "排班時間設置資料格式錯誤",
    };
  }

  // 取得需求日期是星期幾 (1=週一, 7=週日)
  const dayOfWeek = demandDate.getUTCDay() === 0 ? 7 : demandDate.getUTCDay();

  // 找出該天的所有可排班時段
  const dayBlocks = timeBlocks.filter((block) => block.dayOfWeek === dayOfWeek);

  if (dayBlocks.length === 0) {
    return {
      available: false,
      reason: "該日無可排班時段",
      availableTimeBlocks: formatTimeBlocks(timeBlocks),
    };
  }

  // 檢查需求時段是否完全被任一可排班時段覆蓋
  // 支援新格式 { dayOfWeek, timeSlots: [{startTime, endTime}] } 和舊格式 { dayOfWeek, startTime, endTime }
  const isWithinAnyBlock = dayBlocks.some((block) => {
    // 新格式：有 timeSlots 陣列
    if (block.timeSlots && Array.isArray(block.timeSlots)) {
      return block.timeSlots.some((slot) => {
        return timeToMinutes(startTime) >= timeToMinutes(slot.startTime) &&
               timeToMinutes(endTime) <= timeToMinutes(slot.endTime);
      });
    }
    // 舊格式：直接有 startTime 和 endTime
    if (block.startTime && block.endTime) {
      return timeToMinutes(startTime) >= timeToMinutes(block.startTime) &&
             timeToMinutes(endTime) <= timeToMinutes(block.endTime);
    }
    return false;
  });

  if (!isWithinAnyBlock) {
    return {
      available: false,
      reason: "不在可排班時段",
      availableTimeBlocks: formatTimeBlocks(timeBlocks),
    };
  }

  return { available: true };
}

/**
 * 計算需求單的人力可行性
 * @returns { availableWorkers: Worker[], unavailableWorkers: Array<{ worker, reasons }>, shortage: number }
 */
export async function calculateDemandFeasibility(
  demandId: number,
  demandDate: Date,
  startTime: string,
  endTime: string,
  requiredWorkers: number
) {
  const allWorkers = await getAllWorkers({ status: "active" });

  const scheduledStart = combineDateAndTime(demandDate, startTime);
  const scheduledEnd = combineDateAndTime(demandDate, endTime);

  // 批次查詢：預先載入所有員工的當天 assignments
  const dayStart = new Date(demandDate);
  dayStart.setUTCHours(0, 0, 0, 0); // 使用 UTC 避免伺服器本地時區影響
  const dayEnd = new Date(demandDate);
  dayEnd.setUTCHours(23, 59, 59, 999); // 使用 UTC 避免伺服器本地時區影響

  // 使用 Promise.all 並行查詢所有員工的 assignments
  const allDayAssignments = await Promise.all(
    allWorkers.map(worker => getAssignmentsByWorker(worker.id, dayStart, dayEnd))
  );

  // 建立 worker ID 到 assignments 的映射
  const workerAssignmentsMap = new Map<number, any[]>();
  allWorkers.forEach((worker, index) => {
    workerAssignmentsMap.set(worker.id, allDayAssignments[index]);
  });

  // 預先查詢所有相關的 demands 和 clients（去重）
  const uniqueDemandIds = new Set<number>();
  allDayAssignments.flat().forEach(assignment => {
    if (assignment.status !== "cancelled" && assignment.demandId !== demandId) {
      uniqueDemandIds.add(assignment.demandId);
    }
  });

  const demandsMap = new Map<number, any>();
  const clientsMap = new Map<number, any>();
  
  await Promise.all(
    Array.from(uniqueDemandIds).map(async (id) => {
      const demand = await import("./db").then(m => m.getDemandById(id));
      if (demand) {
        demandsMap.set(id, demand);
        if (!clientsMap.has(demand.clientId)) {
          const client = await getClientById(demand.clientId);
          if (client) clientsMap.set(demand.clientId, client);
        }
      }
    })
  );

  // 並行處理所有員工
  const workerChecks = await Promise.all(
    allWorkers.map(async (worker) => {
      const reasons: string[] = [];

      // 檢查排班時間設置
      const availabilityCheck = await checkWorkerAvailability(
        worker.id,
        demandDate,
        startTime,
        endTime
      );

      if (!availabilityCheck.available) {
        reasons.push(availabilityCheck.reason || "不在可排班時段");
        if (availabilityCheck.availableTimeBlocks) {
          reasons.push(`本週可排：${availabilityCheck.availableTimeBlocks}`);
        }
      }

      // 從 map 中取得當天 assignments（已預先查詢）
      const dayAssignments = workerAssignmentsMap.get(worker.id) || [];
      const activeAssignments = dayAssignments.filter(
        (a) => {
          // 排除已取消的指派記錄
          if (a.status === "cancelled") return false;
          // 排除當前需求單的指派
          if (a.demandId === demandId) return false;
          // 排除已取消需求單的指派
          const assignedDemand = demandsMap.get(a.demandId);
          if (assignedDemand && assignedDemand.status === "cancelled") return false;
          return true;
        }
      );

      if (activeAssignments.length > 0) {
        // 檢查時段是否重疊
        for (const assignment of activeAssignments) {
          const assignmentStart = new Date(assignment.scheduledStart);
          const assignmentEnd = new Date(assignment.scheduledEnd);
          
          // 只有當時段真正重疊時才標記為衝突
          if (isTimeOverlap(scheduledStart, scheduledEnd, assignmentStart, assignmentEnd)) {
            const assignedDemand = demandsMap.get(assignment.demandId);
            const assignedClient = assignedDemand ? clientsMap.get(assignedDemand.clientId) : null;
            const assignedTimeStr = `${formatTime(assignmentStart)}-${formatTime(assignmentEnd)}`;
            reasons.push(`排班衝突：${assignedClient?.name || "未知客戶"} ${assignedTimeStr}`);
          }
        }
      }

      // 檢查工作許可是否已過期（有工作許可但已過期）
      if (worker.hasWorkPermit && worker.workPermitExpiryDate) {
        const expiryDate = new Date(worker.workPermitExpiryDate);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0); // 使用 UTC 避免伺服器本地時區影響
        if (expiryDate < today) {
          const expiryStr = expiryDate.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
          reasons.push(`PERMIT_EXPIRED:工作許可已於 ${expiryStr} 過期`);
        }
      }

      return { worker, reasons };
    })
  );

  const availableWorkers = workerChecks
    .filter(check => check.reasons.length === 0)
    .map(check => check.worker);
  
  const unavailableWorkers = workerChecks
    .filter(check => check.reasons.length > 0)
    .map(check => ({
      worker: check.worker,
      reasons: check.reasons,
      // 標記是否僅因「許可已過期」而不可指派（其他時段、衝突等屬於真正不可指派）
      isExpiredPermitOnly: check.reasons.length > 0 && check.reasons.every(r => r.startsWith('PERMIT_EXPIRED:')),
    }));

  // 計算本週已排工時與近 7 天排班次數（用於排序）
  // 批次查詢：並行查詢所有可用員工的 assignments
  const weekStart = getWeekStart(demandDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999); // 使用 UTC 避免伺服器本地時區影響

  const last7DaysStart = new Date(demandDate);
  last7DaysStart.setDate(last7DaysStart.getDate() - 7);

  const [allWeekAssignments, allLast7DaysAssignments] = await Promise.all([
    Promise.all(availableWorkers.map(worker => getAssignmentsByWorker(worker.id, weekStart, weekEnd))),
    Promise.all(availableWorkers.map(worker => getAssignmentsByWorker(worker.id, last7DaysStart, demandDate)))
  ]);

  const workersWithStats = availableWorkers.map((worker, index) => {
    const weekAssignments = allWeekAssignments[index];
    const weekMinutes = weekAssignments
      .filter((a) => a.status !== "cancelled")
      .reduce((sum, a) => sum + (a.scheduledHours || 0), 0);
    const weekHours = weekMinutes / 60; // scheduledHours 是分鐘，轉換為小時

    const last7DaysAssignments = allLast7DaysAssignments[index];
    const last7DaysCount = last7DaysAssignments.filter((a) => a.status !== "cancelled").length;

    return {
      ...worker,
      weekHours,
      last7DaysCount,
    };
  });

  // 排序：本週工時少 → 近 7 天排班少 → 姓名
  workersWithStats.sort((a, b) => {
    if (a.weekHours !== b.weekHours) return a.weekHours - b.weekHours;
    if (a.last7DaysCount !== b.last7DaysCount) return a.last7DaysCount - b.last7DaysCount;
    return a.name.localeCompare(b.name, "zh-TW");
  });

  const shortage = Math.max(0, requiredWorkers - workersWithStats.length);

  return {
    availableWorkers: workersWithStats,
    unavailableWorkers,
    shortage,
  };
}

/**
 * 取得指定日期所在週的週一日期（UTC 00:00:00）
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // 週日為 0，需要往前 6 天
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * 將日期與時間字串組合成 Date 物件
 */
export function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  // 使用 setUTCHours 避免伺服器本地時區影響
  // 前端傳入的 time 字串（HH:mm）是台灣時間，但資料庫儲 UTC
  // 前端已用 setUTCHours 建立時間，此處保持一致
  result.setUTCHours(hours, minutes, 0, 0);
  return result;
}

/**
 * 將時間字串轉換為分鐘數（用於比較）
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 格式化 timeBlocks 為可讀字串
 */
function formatTimeBlocks(timeBlocks: Array<{ dayOfWeek: number; startTime?: string; endTime?: string; timeSlots?: Array<{ startTime: string; endTime: string }> }>): string {
  const dayNames = ["", "週一", "週二", "週三", "週四", "週五", "週六", "週日"];
  const grouped = timeBlocks.reduce((acc, block) => {
    if (!acc[block.dayOfWeek]) acc[block.dayOfWeek] = [];
    
    // 支援新格式：有 timeSlots 陣列
    if (block.timeSlots && Array.isArray(block.timeSlots)) {
      block.timeSlots.forEach((slot) => {
        acc[block.dayOfWeek].push(`${slot.startTime}-${slot.endTime}`);
      });
    }
    // 支援舊格式：直接有 startTime 和 endTime
    else if (block.startTime && block.endTime) {
      acc[block.dayOfWeek].push(`${block.startTime}-${block.endTime}`);
    }
    
    return acc;
  }, {} as Record<number, string[]>);

  return Object.entries(grouped)
    .map(([day, times]) => `${dayNames[Number(day)]} ${times.join("、")}`)
    .join("；");
}

/**
 * 格式化日期為 YYYY/M/D 星期幾
 */
export function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const weekday = weekdays[date.getUTCDay()];
  return `${year}/${month}/${day} ${weekday}`;
}

/**
 * 格式化時間為 HH:mm
 */
export function formatTime(date: Date): string {
  // 使用 getUTCHours/getUTCMinutes 避免伺服器本地時區影響
  // 資料庫儲存 UTC 時間，顯示時應以 UTC 讀取（前端再轉換為台灣時區）
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * 計算兩個時間之間的分鐘數
 */
export function calculateMinutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * 計算員工對需求的排班吻合度分數
 * 回傳 0-100 分：
 *   100 = 完全吻合（在可排班時段內，無衝突）
 *   70-99 = 部分重疊（排班時段有部分重疊）
 *   30-69 = 同日有排班但時段不符
 *   1-29 = 本週有排班但非同日
 *   0 = 無排班設定或有指派衝突
 */
export async function calculateWorkerFitScore(
  workerId: number,
  demandDate: Date,
  startTime: string,
  endTime: string,
  hasConflict: boolean
): Promise<{ score: number; fitLabel: string; fitDetail?: string }> {
  if (hasConflict) {
    return { score: 0, fitLabel: "排班衝突", fitDetail: "該時段已有其他指派" };
  }

  const weekStartDate = getWeekStart(demandDate);
  const availability = await getAvailabilityByWorkerAndWeek(workerId, weekStartDate);

  if (!availability || !availability.confirmedAt) {
    return { score: 0, fitLabel: "無排班設定", fitDetail: "本週排班時間未設定或未確認" };
  }

  let timeBlocks: Array<{
    dayOfWeek: number;
    startTime?: string;
    endTime?: string;
    timeSlots?: Array<{ startTime: string; endTime: string }>;
  }> = [];

  try {
    timeBlocks = JSON.parse(availability.timeBlocks);
  } catch {
    return { score: 0, fitLabel: "無排班設定", fitDetail: "排班資料格式錯誤" };
  }

  const dayOfWeek = demandDate.getUTCDay() === 0 ? 7 : demandDate.getUTCDay();
  const demandStart = timeToMinutes(startTime);
  const demandEnd = timeToMinutes(endTime);
  const demandDuration = demandEnd - demandStart;

  // 找出同日的時段
  const dayBlocks = timeBlocks.filter((b) => b.dayOfWeek === dayOfWeek);

  if (dayBlocks.length > 0) {
    // 計算最大重疊分鐘數
    let maxOverlapMinutes = 0;
    for (const block of dayBlocks) {
      const slots = block.timeSlots && Array.isArray(block.timeSlots)
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
      // 完全覆蓋（但已被 checkWorkerAvailability 標為不可用，可能是其他原因）
      return { score: 85, fitLabel: "時段接近", fitDetail: "排班時段完全覆蓋需求" };
    } else if (maxOverlapMinutes > 0) {
      const overlapPct = Math.round((maxOverlapMinutes / demandDuration) * 100);
      const score = 50 + Math.round(overlapPct * 0.35); // 50-85
      return {
        score,
        fitLabel: "部分重疊",
        fitDetail: `排班時段與需求重疊 ${maxOverlapMinutes} 分鐘（${overlapPct}%）`,
      };
    } else {
      // 同日有排班但時段不重疊
      return { score: 30, fitLabel: "同日有排班", fitDetail: "同日有排班但時段不重疊" };
    }
  }

  // 本週其他日有排班
  if (timeBlocks.length > 0) {
    return { score: 10, fitLabel: "本週有排班", fitDetail: "本週有排班，但非需求當日" };
  }

  return { score: 0, fitLabel: "無排班設定", fitDetail: "本週無任何排班設定" };
}

/**
 * 計算需求單的人力可行性（含全部員工，依吻合度排序）
 * 回傳 availableWorkers（完全符合）、schedulableWorkers（排班外但可聯繫）、conflictWorkers（有指派衝突）
 */
export async function calculateDemandFeasibilityWithAll(
  demandId: number,
  demandDate: Date,
  startTime: string,
  endTime: string,
  requiredWorkers: number
) {
  // 複用現有的 feasibility 計算
  const base = await calculateDemandFeasibility(demandId, demandDate, startTime, endTime, requiredWorkers);

  // 對 unavailableWorkers 計算吻合度分數
  const unavailableWithScore = await Promise.all(
    base.unavailableWorkers.map(async (item) => {
      const hasConflict = item.reasons.some((r) => r.startsWith("排班衝突"));
      const fit = await calculateWorkerFitScore(
        item.worker.id,
        demandDate,
        startTime,
        endTime,
        hasConflict
      );
      return {
        ...item,
        fitScore: fit.score,
        fitLabel: fit.fitLabel,
        fitDetail: fit.fitDetail,
        isConflict: hasConflict,
      };
    })
  );

  // 分成「可聯繫（排班外）」和「衝突」兩組
  const schedulableWorkers = unavailableWithScore
    .filter((w) => !w.isConflict)
    .sort((a, b) => b.fitScore - a.fitScore || a.worker.name.localeCompare(b.worker.name, "zh-TW"));

  const conflictWorkers = unavailableWithScore
    .filter((w) => w.isConflict)
    .sort((a, b) => a.worker.name.localeCompare(b.worker.name, "zh-TW"));

  return {
    availableWorkers: base.availableWorkers,
    schedulableWorkers,
    conflictWorkers,
    shortage: base.shortage,
  };
}
