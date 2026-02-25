import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// 查詢需求單資訊
console.log('=== 需求單 #720001 資訊 ===');
const [demands] = await connection.execute(
  'SELECT id, clientId, date, startTime, endTime, requiredWorkers, location FROM demands WHERE id = 720001'
);
console.log(JSON.stringify(demands[0], null, 2));

// 查詢 SAI TUN KHAM 的員工資訊
console.log('\n=== SAI TUN KHAM 員工資訊 ===');
const [workers] = await connection.execute(
  "SELECT id, name, school FROM workers WHERE name LIKE '%SAI TUN KHAM%'"
);
console.log(JSON.stringify(workers, null, 2));

// 查詢 SAI TUN KHAM 的排班時間（本週）
if (workers.length > 0) {
  const workerId = workers[0].id;
  console.log(`\n=== SAI TUN KHAM (ID: ${workerId}) 的排班時間 ===`);
  const [availability] = await connection.execute(
    'SELECT * FROM availability WHERE workerId = ? ORDER BY weekStartDate DESC LIMIT 5',
    [workerId]
  );
  
  for (const avail of availability) {
    console.log(`\n週期：${avail.weekStartDate} ~ ${avail.weekEndDate}`);
    console.log(`時間區塊：${avail.timeBlocks}`);
  }
}

await connection.end();
