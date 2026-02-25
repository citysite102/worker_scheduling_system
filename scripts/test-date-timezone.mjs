// 測試日期與星期幾的判定

const demandDateStr = '2026-02-26';
const demandDate = new Date(demandDateStr);

console.log('=== 日期與星期幾判定測試 ===\n');

console.log(`輸入日期字串：${demandDateStr}`);
console.log(`Date 物件：${demandDate.toISOString()}`);
console.log(`toString()：${demandDate.toString()}`);
console.log(`toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })：${demandDate.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`);

console.log('\n--- getDay() vs getUTCDay() ---');
console.log(`getDay()：${demandDate.getDay()} (0=週日, 1=週一, ..., 6=週六)`);
console.log(`getUTCDay()：${demandDate.getUTCDay()} (0=週日, 1=週一, ..., 6=週六)`);

console.log('\n--- 轉換為 1-7 格式（1=週一, 7=週日）---');
const dayOfWeekUTC = demandDate.getUTCDay() === 0 ? 7 : demandDate.getUTCDay();
const dayOfWeekLocal = demandDate.getDay() === 0 ? 7 : demandDate.getDay();
console.log(`使用 getUTCDay()：${dayOfWeekUTC}`);
console.log(`使用 getDay()：${dayOfWeekLocal}`);

console.log('\n--- 實際星期幾（台灣時區）---');
const taiwanDate = new Date(demandDate.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
console.log(`台灣時區的 Date 物件：${taiwanDate.toString()}`);
console.log(`台灣時區的星期幾：${taiwanDate.getDay()} (0=週日, 1=週一, ..., 6=週六)`);

console.log('\n--- 結論 ---');
console.log(`2026-02-26 在台灣時區是星期${['日', '一', '二', '三', '四', '五', '六'][taiwanDate.getDay()]}`);
console.log(`但 getUTCDay() 回傳的是星期${['日', '一', '二', '三', '四', '五', '六'][demandDate.getUTCDay()]}`);
