import { calculateDemandFeasibility } from '../server/businessLogic.js';

// 需求單 #720001 的資訊
const demandId = 720001;
const demandDate = new Date('2026-02-26');
const startTime = '15:42';
const endTime = '19:42';
const requiredWorkers = 4;

console.log('=== 測試 calculateDemandFeasibility ===');
console.log(`需求單 ID：${demandId}`);
console.log(`需求日期：${demandDate.toISOString()}`);
console.log(`需求時段：${startTime} - ${endTime}`);
console.log(`需求人數：${requiredWorkers}`);

const result = await calculateDemandFeasibility(
  demandId,
  demandDate,
  startTime,
  endTime,
  requiredWorkers
);

console.log('\n=== 可用員工 ===');
console.log(`數量：${result.availableWorkers.length}`);
result.availableWorkers.forEach(worker => {
  console.log(`- ${worker.name} (ID: ${worker.id})`);
});

console.log('\n=== 不可用員工 ===');
console.log(`數量：${result.unavailableWorkers.length}`);

// 找出 SAI TUN KHAM
const saiTunKham = result.unavailableWorkers.find(item => item.worker.name === 'SAI TUN KHAM');
if (saiTunKham) {
  console.log('\n=== SAI TUN KHAM 的狀態 ===');
  console.log(`員工 ID：${saiTunKham.worker.id}`);
  console.log(`不可用原因：`);
  saiTunKham.reasons.forEach(reason => {
    console.log(`  - ${reason}`);
  });
} else {
  console.log('\nSAI TUN KHAM 在可用員工列表中！');
}

console.log(`\n=== 人力缺口 ===`);
console.log(`缺口：${result.shortage} 人`);

process.exit(0);
