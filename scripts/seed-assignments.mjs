import { drizzle } from 'drizzle-orm/mysql2';
import { workers, clients, demands, assignments, availability } from '../drizzle/schema.ts';
import { eq, and, gte, lte } from 'drizzle-orm';

// 連接資料庫
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const db = drizzle(connectionString);

// 工作時段選項（小時）
const WORK_SHIFTS = [
  { start: '08:00', end: '12:00' },   // 早班
  { start: '09:00', end: '17:00' },   // 日班
  { start: '13:00', end: '17:00' },  // 午班
  { start: '18:00', end: '22:00' },  // 晚班
];

// 隨機選擇函式
function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// 隨機整數（包含 min 和 max）
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 取得週一日期（UTC）
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // 調整為週一
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff, 0, 0, 0, 0));
}

// 取得週日日期（UTC）
function getWeekEnd(weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  return weekEnd;
}

// 生成隨機排班時間（Availability）
async function seedAvailabilities() {
  console.log('開始建立隨機排班時間...');
  
  // 取得所有員工
  const allWorkers = await db.select().from(workers);
  console.log(`找到 ${allWorkers.length} 位員工`);
  
  // 為每位員工建立未來 4 週的排班時間
  const availabilityData = [];
  const today = new Date();
  
  for (const worker of allWorkers) {
    for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
      const currentWeekStart = new Date(today);
      currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() + (weekOffset * 7));
      const weekStart = getWeekStart(currentWeekStart);
      const weekEnd = getWeekEnd(weekStart);
      
      // 隨機選擇 3-5 個工作日（1=週一, 2=週二, ..., 5=週五）
      const numDays = randomInt(3, 5);
      const selectedDays = new Set();
      
      while (selectedDays.size < numDays) {
        selectedDays.add(randomInt(1, 5)); // 週一到週五
      }
      
      // 建立 timeBlocks
      const timeBlocks = [];
      for (const dayOfWeek of selectedDays) {
        const shift = randomChoice(WORK_SHIFTS);
        timeBlocks.push({
          dayOfWeek,
          startTime: shift.start,
          endTime: shift.end,
        });
      }
      
      availabilityData.push({
        workerId: worker.id,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        timeBlocks: JSON.stringify(timeBlocks),
      });
    }
  }
  
  // 批次插入
  if (availabilityData.length > 0) {
    await db.insert(availability).values(availabilityData);
    console.log(`✅ 成功建立 ${availabilityData.length} 筆排班時間（${allWorkers.length} 位員工 × 4 週）`);
  }
}

// 簡化版：隨機指派員工到需求單（不檢查 availability，只檢查基本衝突）
async function seedAssignments() {
  console.log('開始建立隨機指派...');
  
  // 取得所有「已確認」的需求單
  const confirmedDemands = await db
    .select()
    .from(demands)
    .where(eq(demands.status, 'confirmed'));
  
  console.log(`找到 ${confirmedDemands.length} 筆已確認的需求單`);
  
  // 取得所有活躍員工
  const activeWorkers = await db
    .select()
    .from(workers)
    .where(eq(workers.status, 'active'));
  
  console.log(`找到 ${activeWorkers.length} 位活躍員工`);
  
  // 一次性取得所有已存在的指派記錄（減少查詢次數）
  const allAssignments = await db
    .select()
    .from(assignments)
    .where(eq(assignments.status, 'assigned'));
  
  console.log(`現有 ${allAssignments.length} 筆指派記錄`);
  
  let assignmentCount = 0;
  let skippedCount = 0;
  
  for (const demand of confirmedDemands) {
    // 檢查已指派人數
    const existingAssignments = allAssignments.filter(a => a.demandId === demand.id);
    const remainingSlots = demand.requiredWorkers - existingAssignments.length;
    
    if (remainingSlots <= 0) {
      skippedCount++;
      continue; // 已滿額
    }
    
    // 隨機決定要指派幾位員工（70%-100% 的需求人數）
    const numToAssign = Math.min(
      randomInt(Math.ceil(remainingSlots * 0.7), remainingSlots),
      activeWorkers.length
    );
    
    // 隨機選擇可用員工
    const shuffledWorkers = [...activeWorkers].sort(() => Math.random() - 0.5);
    let assigned = 0;
    
    for (const worker of shuffledWorkers) {
      if (assigned >= numToAssign) break;
      
      // 檢查是否已指派到這個需求單
      const alreadyAssigned = existingAssignments.some(a => a.workerId === worker.id);
      if (alreadyAssigned) continue;
      
      // 簡化版：不檢查時間衝突，直接指派
      // （實際使用時應該要檢查，但為了測試資料快速建置，這裡簡化）
      
      // 建立指派（加入必填的 scheduledStart 和 scheduledEnd）
      // 使用 demand.date + startTime/endTime 組合成完整的 timestamp
      const demandDate = new Date(demand.date);
      const [startHour, startMinute] = demand.startTime.split(':').map(Number);
      const [endHour, endMinute] = demand.endTime.split(':').map(Number);
      
      const scheduledStart = new Date(Date.UTC(
        demandDate.getUTCFullYear(),
        demandDate.getUTCMonth(),
        demandDate.getUTCDate(),
        startHour,
        startMinute,
        0,
        0
      ));
      
      const scheduledEnd = new Date(Date.UTC(
        demandDate.getUTCFullYear(),
        demandDate.getUTCMonth(),
        demandDate.getUTCDate(),
        endHour,
        endMinute,
        0,
        0
      ));
      
      // 計算 scheduledHours（以分鐘為單位）
      const scheduledMinutes = (scheduledEnd - scheduledStart) / (1000 * 60);
      
      const [newAssignment] = await db.insert(assignments).values({
        demandId: demand.id,
        workerId: worker.id,
        scheduledStart,
        scheduledEnd,
        scheduledHours: scheduledMinutes,
        status: 'assigned',
      });
      
      // 更新記憶體中的指派列表
      allAssignments.push({
        id: newAssignment.insertId,
        demandId: demand.id,
        workerId: worker.id,
        status: 'assigned',
      });
      
      assigned++;
      assignmentCount++;
    }
    
    if (assigned > 0) {
      console.log(`需求單 #${demand.id}：已指派 ${assigned}/${demand.requiredWorkers} 位員工`);
    }
  }
  
  console.log(`✅ 成功建立 ${assignmentCount} 筆指派記錄`);
  console.log(`⏭️  跳過 ${skippedCount} 筆已滿額的需求單`);
}

// 主函式
async function main() {
  try {
    console.log('========================================');
    console.log('開始建置隨機排班與指派測試資料');
    console.log('========================================\n');
    
    // 步驟 1：建立排班時間
    await seedAvailabilities();
    console.log('');
    
    // 步驟 2：建立指派記錄
    await seedAssignments();
    console.log('');
    
    console.log('========================================');
    console.log('✅ 測試資料建置完成！');
    console.log('========================================');
    
  } catch (error) {
    console.error('❌ 錯誤：', error);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
