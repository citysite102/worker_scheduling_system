import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// 需求單日期
const demandDate = new Date('2026-02-26');
console.log('需求單日期：', demandDate.toISOString());
console.log('星期幾（UTC）：', demandDate.getUTCDay(), '(0=週日, 1=週一, ..., 6=週六)');

// 計算該週的週一日期（UTC）
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // 調整到週一
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
}

const weekStart = getWeekStart(demandDate);
console.log('該週週一日期：', weekStart.toISOString());

// 查詢 SAI TUN KHAM 在該週的排班資料
const [availability] = await connection.execute(`
  SELECT * FROM availability 
  WHERE workerId = 540001 
  AND weekStartDate <= ? 
  AND weekEndDate >= ?
  ORDER BY weekStartDate DESC
  LIMIT 1
`, [demandDate, demandDate]);

console.log('\n=== SAI TUN KHAM 在該週的排班資料 ===');
if (availability.length > 0) {
  const avail = availability[0];
  console.log('ID:', avail.id);
  console.log('週期：', avail.weekStartDate, '~', avail.weekEndDate);
  console.log('已確認：', avail.confirmedAt ? '是' : '否');
  console.log('時間區塊：', avail.timeBlocks);
  
  // 解析時間區塊
  const timeBlocks = JSON.parse(avail.timeBlocks);
  console.log('\n解析後的時間區塊：');
  timeBlocks.forEach(block => {
    const dayNames = ['', '週一', '週二', '週三', '週四', '週五', '週六', '週日'];
    console.log(`  ${dayNames[block.dayOfWeek]}：${block.startTime || '?'}-${block.endTime || '?'}`);
    if (block.timeSlots) {
      block.timeSlots.forEach(slot => {
        console.log(`    - ${slot.startTime}-${slot.endTime}`);
      });
    }
  });
  
  // 檢查星期四的排班時間
  const thursdayBlocks = timeBlocks.filter(b => b.dayOfWeek === 4);
  console.log('\n星期四的排班時間：');
  if (thursdayBlocks.length === 0) {
    console.log('  無');
  } else {
    thursdayBlocks.forEach(block => {
      if (block.timeSlots) {
        block.timeSlots.forEach(slot => {
          console.log(`  ${slot.startTime}-${slot.endTime}`);
        });
      } else {
        console.log(`  ${block.startTime}-${block.endTime}`);
      }
    });
  }
} else {
  console.log('該週無排班資料');
}

await connection.end();
