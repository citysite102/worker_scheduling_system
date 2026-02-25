import { checkWorkerAvailability } from '../server/businessLogic.js';

// 需求單資訊
const demandDate = new Date('2026-02-26'); // 星期四
const startTime = '15:42';
const endTime = '19:42';

// SAI TUN KHAM 的 ID
const workerId = 540001;

console.log('=== 測試 checkWorkerAvailability ===');
console.log(`需求日期：${demandDate.toISOString()} (星期${demandDate.getDay()})`);
console.log(`需求時段：${startTime} - ${endTime}`);
console.log(`員工 ID：${workerId}`);

const result = await checkWorkerAvailability(
  workerId,
  demandDate,
  startTime,
  endTime
);

console.log('\n=== 檢查結果 ===');
console.log(JSON.stringify(result, null, 2));

process.exit(0);
