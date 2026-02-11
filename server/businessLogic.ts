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
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(scheduledEnd);
  endDate.setHours(23, 59, 59, 999);

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
  const dayOfWeek = demandDate.getDay() === 0 ? 7 : demandDate.getDay();

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

  const availableWorkers = [];
  const unavailableWorkers = [];

  for (const worker of allWorkers) {
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

    // 檢查同一天是否已指派到其他需求單（無論時間是否重疊）
    const dayStart = new Date(demandDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(demandDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    const dayAssignments = await getAssignmentsByWorker(worker.id, dayStart, dayEnd);
    const activeAssignments = dayAssignments.filter(
      (a) => a.status !== "cancelled" && a.demandId !== demandId
    );

    if (activeAssignments.length > 0) {
      for (const assignment of activeAssignments) {
        const assignedDemand = await import("./db").then(m => m.getDemandById(assignment.demandId));
        const assignedClient = assignedDemand ? await getClientById(assignedDemand.clientId) : null;
        const assignedTimeStr = `${formatTime(new Date(assignment.scheduledStart))}-${formatTime(new Date(assignment.scheduledEnd))}`;
        reasons.push(`已指派到：${assignedClient?.name || "未知客戶"} ${assignedTimeStr}`);
      }
    }

    if (reasons.length === 0) {
      availableWorkers.push(worker);
    } else {
      unavailableWorkers.push({ worker, reasons });
    }
  }

  // 計算本週已排工時與近 7 天排班次數（用於排序）
  const workersWithStats = await Promise.all(
    availableWorkers.map(async (worker) => {
      const weekStart = getWeekStart(demandDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekAssignments = await getAssignmentsByWorker(worker.id, weekStart, weekEnd);
      const weekMinutes = weekAssignments
        .filter((a) => a.status !== "cancelled")
        .reduce((sum, a) => sum + (a.scheduledHours || 0), 0);
      const weekHours = weekMinutes / 60; // scheduledHours 是分鐘，轉換為小時

      const last7DaysStart = new Date(demandDate);
      last7DaysStart.setDate(last7DaysStart.getDate() - 7);
      const last7DaysAssignments = await getAssignmentsByWorker(worker.id, last7DaysStart, demandDate);
      const last7DaysCount = last7DaysAssignments.filter((a) => a.status !== "cancelled").length;

      return {
        ...worker,
        weekHours,
        last7DaysCount,
      };
    })
  );

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
  result.setHours(hours, minutes, 0, 0);
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
 * 格式化日期為 YYYY/MM/DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

/**
 * 格式化時間為 HH:mm
 */
export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * 計算兩個時間之間的分鐘數
 */
export function calculateMinutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}
