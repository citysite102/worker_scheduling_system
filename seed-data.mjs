import mysql from 'mysql2/promise';
import 'dotenv/config';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('開始建立測試資料...');

try {
  // 1. 建立移工資料（8 位，其中 2 位停用）
  const workers = [
    { name: '王大明', phone: '0912-345-678', email: 'wang@example.com', status: 'active' },
    { name: '陳小春', phone: '0922-456-789', email: 'chen@example.com', status: 'active' },
    { name: '林志玲', phone: '0933-567-890', email: 'lin@example.com', status: 'active' },
    { name: '李四', phone: '0944-678-901', email: 'li@example.com', status: 'active' },
    { name: '張三豐', phone: '0955-789-012', email: 'zhang@example.com', status: 'active' },
    { name: '周芷若', phone: '0966-890-123', email: 'zhou@example.com', status: 'active' },
    { name: '趙敏', phone: '0977-901-234', email: 'zhao@example.com', status: 'inactive' },
    { name: '楊過', phone: '0988-012-345', email: 'yang@example.com', status: 'inactive' },
  ];

  for (const worker of workers) {
    await connection.execute(
      'INSERT INTO workers (name, phone, email, status) VALUES (?, ?, ?, ?)',
      [worker.name, worker.phone, worker.email, worker.status]
    );
  }
  console.log('✓ 已建立 8 位移工（2 位停用）');

  // 2. 建立客戶資料（3 位）
  const clients = [
    { name: '大潤發桃園店', contactName: '林經理', contactPhone: '03-1234567', address: '桃園市中壢區中山路123號' },
    { name: '家樂福台北店', contactName: '陳店長', contactPhone: '02-2345678', address: '台北市信義區忠孝東路456號' },
    { name: '全聯新竹店', contactName: '王主任', contactPhone: '03-9876543', address: '新竹市東區光復路789號' },
  ];

  for (const client of clients) {
    await connection.execute(
      'INSERT INTO clients (name, contactName, contactPhone, address, status) VALUES (?, ?, ?, ?, ?)',
      [client.name, client.contactName, client.contactPhone, client.address, 'active']
    );
  }
  console.log('✓ 已建立 3 位客戶');

  // 3. 建立本週可排班時間（為前 6 位啟用的移工建立）
  // 本週一為 2026-02-09，週日為 2026-02-15
  const weekStart = new Date('2026-02-09T00:00:00+08:00');
  const weekEnd = new Date('2026-02-15T23:59:59+08:00');

  const availabilityData = [
    // 王大明：週一到週五 08:00-17:00
    { workerId: 1, timeBlocks: JSON.stringify([
      { dayOfWeek: 1, startTime: '08:00', endTime: '17:00' },
      { dayOfWeek: 2, startTime: '08:00', endTime: '17:00' },
      { dayOfWeek: 3, startTime: '08:00', endTime: '17:00' },
      { dayOfWeek: 4, startTime: '08:00', endTime: '17:00' },
      { dayOfWeek: 5, startTime: '08:00', endTime: '17:00' },
    ]), confirmedAt: new Date() },
    // 陳小春：週一到週日 09:00-18:00
    { workerId: 2, timeBlocks: JSON.stringify([
      { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 4, startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 6, startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 7, startTime: '09:00', endTime: '18:00' },
    ]), confirmedAt: new Date() },
    // 林志玲：週一到週五 10:00-19:00
    { workerId: 3, timeBlocks: JSON.stringify([
      { dayOfWeek: 1, startTime: '10:00', endTime: '19:00' },
      { dayOfWeek: 2, startTime: '10:00', endTime: '19:00' },
      { dayOfWeek: 3, startTime: '10:00', endTime: '19:00' },
      { dayOfWeek: 4, startTime: '10:00', endTime: '19:00' },
      { dayOfWeek: 5, startTime: '10:00', endTime: '19:00' },
    ]), confirmedAt: new Date() },
    // 李四：週一到週五 14:00-22:00
    { workerId: 4, timeBlocks: JSON.stringify([
      { dayOfWeek: 1, startTime: '14:00', endTime: '22:00' },
      { dayOfWeek: 2, startTime: '14:00', endTime: '22:00' },
      { dayOfWeek: 3, startTime: '14:00', endTime: '22:00' },
      { dayOfWeek: 4, startTime: '14:00', endTime: '22:00' },
      { dayOfWeek: 5, startTime: '14:00', endTime: '22:00' },
    ]), confirmedAt: new Date() },
    // 張三豐：週一到週五 08:00-12:00（僅上午）
    { workerId: 5, timeBlocks: JSON.stringify([
      { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' },
      { dayOfWeek: 2, startTime: '08:00', endTime: '12:00' },
      { dayOfWeek: 3, startTime: '08:00', endTime: '12:00' },
      { dayOfWeek: 4, startTime: '08:00', endTime: '12:00' },
      { dayOfWeek: 5, startTime: '08:00', endTime: '12:00' },
    ]), confirmedAt: new Date() },
    // 周芷若：未確認（confirmedAt 為 null）
    { workerId: 6, timeBlocks: JSON.stringify([
      { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
    ]), confirmedAt: null },
  ];

  for (const avail of availabilityData) {
    await connection.execute(
      'INSERT INTO availability (workerId, weekStartDate, weekEndDate, timeBlocks, confirmedAt) VALUES (?, ?, ?, ?, ?)',
      [avail.workerId, weekStart, weekEnd, avail.timeBlocks, avail.confirmedAt]
    );
  }
  console.log('✓ 已建立 6 位移工的本週可排班時間');

  // 4. 建立用工需求（8 筆，包含會造成衝突的時段）
  const demands = [
    // 今日需求
    { clientId: 1, date: new Date('2026-02-09T00:00:00+08:00'), startTime: '09:00', endTime: '17:00', requiredWorkers: 3, location: '桃園店倉庫', status: 'confirmed' },
    { clientId: 2, date: new Date('2026-02-09T00:00:00+08:00'), startTime: '14:00', endTime: '18:00', requiredWorkers: 5, location: '台北店賣場', status: 'confirmed' },
    // 明日需求
    { clientId: 1, date: new Date('2026-02-10T00:00:00+08:00'), startTime: '10:00', endTime: '15:00', requiredWorkers: 2, location: '桃園店', status: 'confirmed' },
    { clientId: 3, date: new Date('2026-02-10T00:00:00+08:00'), startTime: '14:00', endTime: '20:00', requiredWorkers: 4, location: '新竹店', status: 'confirmed' },
    // 後天需求
    { clientId: 2, date: new Date('2026-02-11T00:00:00+08:00'), startTime: '08:00', endTime: '12:00', requiredWorkers: 2, location: '台北店', status: 'draft' },
    { clientId: 1, date: new Date('2026-02-11T00:00:00+08:00'), startTime: '13:00', endTime: '18:00', requiredWorkers: 3, location: '桃園店', status: 'confirmed' },
    // 週四需求
    { clientId: 3, date: new Date('2026-02-12T00:00:00+08:00'), startTime: '09:00', endTime: '17:00', requiredWorkers: 4, location: '新竹店', status: 'confirmed' },
    // 週五需求
    { clientId: 2, date: new Date('2026-02-13T00:00:00+08:00'), startTime: '10:00', endTime: '16:00', requiredWorkers: 3, location: '台北店', status: 'draft' },
  ];

  for (const demand of demands) {
    await connection.execute(
      'INSERT INTO demands (clientId, date, startTime, endTime, requiredWorkers, location, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [demand.clientId, demand.date, demand.startTime, demand.endTime, demand.requiredWorkers, demand.location, demand.status]
    );
  }
  console.log('✓ 已建立 8 筆用工需求');

  // 5. 建立排班記錄（10 筆，確保能測到衝突與一鍵湊滿不足的情境）
  const assignments = [
    // 今日排班（2026-02-09）
    // 需求 1 (09:00-17:00) 已指派 2 人
    { demandId: 1, workerId: 1, scheduledStart: new Date('2026-02-09T09:00:00+08:00'), scheduledEnd: new Date('2026-02-09T17:00:00+08:00'), scheduledHours: 480, status: 'assigned' },
    { demandId: 1, workerId: 2, scheduledStart: new Date('2026-02-09T09:00:00+08:00'), scheduledEnd: new Date('2026-02-09T17:00:00+08:00'), scheduledHours: 480, status: 'assigned' },
    // 需求 2 (14:00-18:00) 已指派 1 人（李四）
    { demandId: 2, workerId: 4, scheduledStart: new Date('2026-02-09T14:00:00+08:00'), scheduledEnd: new Date('2026-02-09T18:00:00+08:00'), scheduledHours: 240, status: 'assigned' },
    
    // 明日排班（2026-02-10）
    // 需求 3 (10:00-15:00) 已指派 1 人
    { demandId: 3, workerId: 1, scheduledStart: new Date('2026-02-10T10:00:00+08:00'), scheduledEnd: new Date('2026-02-10T15:00:00+08:00'), scheduledHours: 300, status: 'assigned' },
    // 需求 4 (14:00-20:00) 已指派 2 人
    { demandId: 4, workerId: 2, scheduledStart: new Date('2026-02-10T14:00:00+08:00'), scheduledEnd: new Date('2026-02-10T20:00:00+08:00'), scheduledHours: 360, status: 'assigned' },
    { demandId: 4, workerId: 4, scheduledStart: new Date('2026-02-10T14:00:00+08:00'), scheduledEnd: new Date('2026-02-10T20:00:00+08:00'), scheduledHours: 360, status: 'assigned' },
    
    // 後天排班（2026-02-11）
    // 需求 5 (08:00-12:00) 已指派 2 人
    { demandId: 5, workerId: 1, scheduledStart: new Date('2026-02-11T08:00:00+08:00'), scheduledEnd: new Date('2026-02-11T12:00:00+08:00'), scheduledHours: 240, status: 'completed', actualStart: new Date('2026-02-11T08:05:00+08:00'), actualEnd: new Date('2026-02-11T12:10:00+08:00'), actualHours: 245, varianceHours: 5 },
    { demandId: 5, workerId: 5, scheduledStart: new Date('2026-02-11T08:00:00+08:00'), scheduledEnd: new Date('2026-02-11T12:00:00+08:00'), scheduledHours: 240, status: 'completed', actualStart: new Date('2026-02-11T08:00:00+08:00'), actualEnd: new Date('2026-02-11T12:00:00+08:00'), actualHours: 240, varianceHours: 0 },
    
    // 需求 6 (13:00-18:00) 已指派 1 人
    { demandId: 6, workerId: 3, scheduledStart: new Date('2026-02-11T13:00:00+08:00'), scheduledEnd: new Date('2026-02-11T18:00:00+08:00'), scheduledHours: 300, status: 'assigned' },
    
    // 週四排班（2026-02-12）
    { demandId: 7, workerId: 2, scheduledStart: new Date('2026-02-12T09:00:00+08:00'), scheduledEnd: new Date('2026-02-12T17:00:00+08:00'), scheduledHours: 480, status: 'assigned' },
  ];

  for (const assignment of assignments) {
    await connection.execute(
      'INSERT INTO assignments (demandId, workerId, scheduledStart, scheduledEnd, scheduledHours, actualStart, actualEnd, actualHours, varianceHours, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [assignment.demandId, assignment.workerId, assignment.scheduledStart, assignment.scheduledEnd, assignment.scheduledHours, assignment.actualStart || null, assignment.actualEnd || null, assignment.actualHours || null, assignment.varianceHours || null, assignment.status]
    );
  }
  console.log('✓ 已建立 10 筆排班記錄');

  console.log('\n測試資料建立完成！');
  console.log('摘要：');
  console.log('- 移工：8 位（6 位啟用、2 位停用）');
  console.log('- 客戶：3 位');
  console.log('- 可排班時間：6 位移工的本週時段（1 位未確認）');
  console.log('- 用工需求：8 筆（含今日、明日、後天、週四、週五）');
  console.log('- 排班記錄：10 筆（含時段衝突、已完成、待指派等狀態）');
  console.log('\n可測試情境：');
  console.log('1. 需求 2 (2026-02-09 14:00-18:00) 需要 5 人，目前僅指派 1 人，可測試「一鍵湊滿」與「缺口提示」');
  console.log('2. 李四在 2026-02-09 與 2026-02-10 都有排班，可測試時段衝突檢查');
  console.log('3. 張三豐僅上午可排班，可測試「不在可排班時段」的灰底顯示');
  console.log('4. 周芷若未確認可排班時間，可測試「本週未更新」的提示');
  console.log('5. 趙敏、楊過已停用，可測試「已停用」區塊的折疊顯示');

} catch (error) {
  console.error('建立測試資料時發生錯誤：', error);
} finally {
  await connection.end();
}
