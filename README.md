# 移工排班與工時計算系統 — 技術交接文件

> 本文件供接手開發者或 AI 協作者使用。涵蓋資料庫結構、程式碼規範、已知地雷，以及如何給 AI 下精準指令的實務指南。

---

## 目錄

1. [系統概覽](#1-系統概覽)
2. [技術架構](#2-技術架構)
3. [資料庫結構](#3-資料庫結構)
4. [前端頁面地圖](#4-前端頁面地圖)
5. [後端 API 清單](#5-後端-api-清單)
6. [程式碼規範](#6-程式碼規範)
7. [已知地雷與注意事項](#7-已知地雷與注意事項)
8. [如何給 AI 下精準指令](#8-如何給-ai-下精準指令)
9. [開發流程 SOP](#9-開發流程-sop)
10. [Manus x GitHub 同步開發指南](#10-manus-x-github-同步開發指南)

---

## 1. 系統概覽

這是一套 B2B 移工排班管理系統，主要使用者為**管理員**（內部人員），次要使用者為**客戶**（透過獨立的客戶入口登入）。

**核心業務流程：**

```
客戶提出用工需求（Demand）
  → 管理員審核並指派員工（Assignment）
    → 員工出勤後回填實際工時（ActualTime）
      → 管理員確認薪資並月結（Payroll Settlement）
        → 產出報表（Reports）
```

**兩套登入系統：**

- **管理員**：透過 Manus OAuth 登入（Google 帳號），角色為 `admin`
- **客戶**：透過 `/client-login` 頁面以 Email + 密碼登入，角色為 `client`

---

## 2. 技術架構

| 層級 | 技術 |
|------|------|
| 前端框架 | React 19 + TypeScript + Vite |
| UI 元件庫 | shadcn/ui + Tailwind CSS 4 |
| 路由 | wouter |
| API 通訊 | tRPC 11（型別安全，無需手寫 REST） |
| 後端框架 | Express 4 |
| 資料庫 | MySQL（TiDB），ORM 使用 Drizzle |
| 認證 | Manus OAuth（管理員）+ JWT Cookie（客戶） |
| 檔案儲存 | S3（透過 `storagePut`/`storageGet`） |
| 時區 | 所有時間以 UTC 儲存，前端顯示轉換為台灣時區（UTC+8） |

**關鍵目錄結構：**

```
client/src/
  pages/          ← 頁面元件（管理員後台）
  pages/client-portal/  ← 客戶入口頁面
  components/     ← 可複用 UI 元件
  lib/
    trpc.ts       ← tRPC 客戶端設定
    dateUtils.ts  ← 台灣時區工具函式（重要！）
server/
  routers.ts      ← 所有 tRPC API 定義（主要修改點）
  db.ts           ← 資料庫查詢 helper 函式
  businessLogic.ts ← 排班吻合度計算等業務邏輯
drizzle/
  schema.ts       ← 資料庫 Schema（修改後需執行 migration）
```

---

## 3. 資料庫結構

### 3.1 資料表總覽

| 資料表 | 說明 | 主要欄位 |
|--------|------|----------|
| `users` | 系統使用者（管理員 + 客戶帳號） | `role`（admin/user/client）、`clientId`（客戶帳號關聯） |
| `workers` | 員工基本資料 | `name`、`nationality`、`hasWorkPermit`、`workPermitExpiryDate`、`status` |
| `clients` | 客戶基本資料 | `clientCode`、`name`、`billingType`、`status` |
| `availability` | 員工每週可排班時段 | `workerId`、`weekStartDate`（週一）、`timeBlocks`（JSON） |
| `demands` | 客戶用工需求單 | `clientId`、`date`、`startTime`、`endTime`、`requiredWorkers`、`status` |
| `assignments` | 員工指派記錄 | `demandId`、`workerId`、`scheduledStart/End`、`actualStart/End`、`payType`、`payAmount` |
| `demandTypes` | 需求類型分類 | `name`、`description` |
| `demandTypeOptions` | 需求類型的可選項目 | `demandTypeId`、`content`、`sortOrder` |
| `adminInvites` | 管理員邀請碼 | `code`、`status`（active/used/expired/revoked） |
| `payroll_settlements` | 月結結算確認 | `workerId`、`year`、`month`、`settledBy`、`settledAt` |

### 3.2 重要欄位說明

**`demands.date`**：儲存為 UTC timestamp，代表需求發生的「台灣日期」。例如台灣 2026/03/08 的需求，資料庫儲存為 `2026-03-07 16:00:00 UTC`（UTC+8 轉換後）。

**`demands.startTime` / `demands.endTime`**：儲存為 `HH:mm` 字串（如 `"09:00"`），**不是** timestamp，不受時區影響。

**`assignments.scheduledStart` / `assignments.scheduledEnd`**：儲存為 UTC timestamp，是由 `demand.date` + `demand.startTime` 合併計算後的完整時間點。前端顯示時必須轉換為台灣時區。

**`assignments.scheduledHours` / `actualHours` / `varianceHours`**：以**分鐘**為單位儲存（避免浮點數問題）。顯示時除以 60 轉為小時。

**`assignments.payRate` / `payAmount`**：以**整數元**儲存（避免浮點數問題）。

**`availability.timeBlocks`**：JSON 字串，格式為：
```json
[{"dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00"}]
```
`dayOfWeek` 為 1-7，1=週一，7=週日。

**`demands.selectedOptions`**：JSON 字串，格式為 `"[1,3,5]"`，存放已勾選的 `demandTypeOptions.id`。

### 3.3 資料表關聯圖

```
users ──────────── clients（users.clientId → clients.id）
                       │
workers                └── demands（demands.clientId → clients.id）
   │                           │
   ├── availability             └── assignments（assignments.demandId → demands.id）
   │   （workerId → workers.id）      │
   │                                  └── workers（assignments.workerId → workers.id）
   └── payroll_settlements
       （workerId → workers.id）
```

### 3.4 修改 Schema 的標準流程

```bash
# 1. 修改 drizzle/schema.ts
# 2. 產生 migration SQL
pnpm drizzle-kit generate
# 3. 讀取產生的 .sql 檔案內容
# 4. 透過 webdev_execute_sql 工具執行 SQL（不要手動執行）
# 5. 確認 TypeScript 型別無誤
npx tsc --noEmit
```

> **警告**：資料庫資料無法復原，執行 migration 前務必確認 SQL 內容正確，尤其是 `DROP` 或 `ALTER` 操作。

---

## 4. 前端頁面地圖

### 4.1 管理員後台（需登入，使用 DashboardLayout）

| 路徑 | 頁面元件 | 功能說明 |
|------|----------|----------|
| `/dashboard` | `Dashboard.tsx` | 儀表板，顯示趨勢圖與統計 |
| `/workers` | `Workers.tsx` | 員工列表、搜尋、新增 |
| `/workers/:id` | `WorkerDetail.tsx` | 員工詳情、歷史指派、排班紀錄、時間篩選 |
| `/clients` | `Clients.tsx` | 客戶列表 |
| `/clients/:id` | `ClientDetail.tsx` | 客戶詳情、帳號管理 |
| `/availability` | `Availability.tsx` | 員工可排班時間設定（週視圖） |
| `/demands` | `Demands.tsx` | 需求單列表、新增、批次新增 |
| `/demands/:id` | `DemandDetail.tsx` | 需求單詳情、員工指派（含吻合度排序） |
| `/actual-time` | `ActualTime.tsx` | 實際工時回填（**週視圖**，一次顯示七天） |
| `/reports` | `Reports.tsx` | 薪資報表（日薪/月結模式）、月結結算確認 |
| `/demand-types` | `DemandTypes.tsx` | 需求類型管理 |
| `/admin` | `AdminSettings.tsx` | 管理員邀請碼管理 |

### 4.2 客戶入口（獨立登入系統）

| 路徑 | 頁面元件 | 功能說明 |
|------|----------|----------|
| `/client-login` | `ClientLogin.tsx` | 客戶 Email/密碼登入 |
| `/client-portal/dashboard` | `ClientDashboard.tsx` | 客戶儀表板 |
| `/client-portal/demands` | `ClientDemands.tsx` | 客戶需求單列表 |
| `/client-portal/demands/create` | `CreateDemand.tsx` | 建立新需求單 |
| `/client-portal/demands/:id` | `DemandDetail.tsx` | 需求單詳情（客戶視角） |
| `/client-portal/calendar` | `ClientCalendar.tsx` | 排班行事曆 |

### 4.3 可複用元件

| 元件 | 路徑 | 用途 |
|------|------|------|
| `DashboardLayout` | `components/DashboardLayout.tsx` | 管理員後台側邊欄佈局 |
| `WorkerAvatar` | `components/WorkerAvatar.tsx` | 員工頭像（支援自訂圖片或姓名縮寫） |
| `AIChatBox` | `components/AIChatBox.tsx` | AI 對話介面 |

---

## 5. 後端 API 清單

所有 API 透過 tRPC 定義在 `server/routers.ts`，前端使用 `trpc.{router}.{procedure}` 呼叫。

### 5.1 主要 Router 一覽

| Router | 說明 |
|--------|------|
| `auth` | 登入、登出、密碼管理、Onboarding |
| `workers` | 員工 CRUD、詳情、批次匯入 |
| `clients` | 客戶 CRUD、帳號管理 |
| `availability` | 員工可排班時間的查詢與設定 |
| `demands` | 需求單 CRUD、審核、指派可行性分析 |
| `assignments` | 排班指派、工時回填、薪資填寫 |
| `reports` | 薪資報表、月結結算確認 |
| `dashboard` | 儀表板趨勢圖資料 |
| `admin` | 管理員邀請碼管理 |

### 5.2 重要 API 說明

**`demands.feasibilityWithAll`**：查詢某需求單的員工可指派狀態，回傳三個分組：
- `availableWorkers`：完全符合排班的員工
- `schedulableWorkers`：排班外但可聯繫的員工（含 `fitScore` 吻合度分數，越高越優先）
- `conflictWorkers`：有時段衝突的員工（不建議指派）

**`assignments.listByWeek`**：一次查詢整週的排班記錄，回傳依台灣日期分組的資料，供 ActualTime 週視圖使用。

**`reports.settle` / `reports.unsettle`**：月結結算確認與解鎖，結算後 `fillPayroll` 會拒絕修改該月薪資。

**`demands.copyWeek`**：將來源週所有需求單（草稿狀態）批次複製到目標週，日期依週差自動偏移，不複製已指派員工。

### 5.3 主要 API 呼叫範例

以下為各 Router 最常用的 Procedure 呼叫方式與回傳格式，供接手夥伴快速上手。

#### workers（員工管理）

```typescript
// 取得員工列表
const { data: workers } = trpc.workers.list.useQuery();
// 回傳：Worker[] - 包含 id, name, idNumber, phone, status, avatarUrl, workPermitExpiry

// 取得單一員工詳情
const { data: worker } = trpc.workers.getById.useQuery({ id: 1 });
// 回傳：Worker & { availabilities, assignmentCount }

// 建立員工
const createWorker = trpc.workers.create.useMutation({
  onSuccess: () => utils.workers.list.invalidate(),
});
await createWorker.mutateAsync({
  name: "王小明",
  idNumber: "A123456789",
  phone: "0912345678",
  nationality: "越南",
});
```

#### clients（客戶管理）

```typescript
// 取得客戶列表
const { data: clients } = trpc.clients.list.useQuery({});
// 回傳：{ clients: Client[], total: number }
// Client 包含：id, name, contactName, contactPhone, address, status

// 建立客戶
const createClient = trpc.clients.create.useMutation();
await createClient.mutateAsync({
  name: "良新國際洋酒",
  contactName: "陳經理",
  contactPhone: "02-12345678",
});
```

#### demands（需求單管理）

```typescript
// 取得需求單列表（含分頁）
const { data } = trpc.demands.list.useQuery({
  status: "pending",  // 可選：pending | approved | assigned | completed | cancelled | closed
  page: 1,
  pageSize: 20,
});
// 回傳：{ demands: Demand[], pagination: { total, page, pageSize, totalPages } }

// 取得單一需求單詳情
const { data: demand } = trpc.demands.getById.useQuery({ id: 1 });
// 回傳：Demand & { client, assignments: Assignment[], demandType }

// 建立需求單
const createDemand = trpc.demands.create.useMutation();
await createDemand.mutateAsync({
  clientId: 1,
  date: new Date("2026-04-18"),  // ⚠️ 注意：傳 Date 物件，後端存 UTC
  startTime: "09:00",
  endTime: "18:00",
  location: "桃園",
  requiredWorkers: 3,
});

// 查詢員工可指派狀態（含吻合度排序）
const { data: feasibility } = trpc.demands.feasibilityWithAll.useQuery({ demandId: 1 });
// 回傳：{
//   availableWorkers: WorkerWithStatus[],    // 完全符合排班
//   schedulableWorkers: WorkerWithFitScore[], // 排班外可聯繫（fitScore 越高越優先）
//   conflictWorkers: WorkerWithStatus[],      // 有時段衝突
// }

// 複製週排班（預覽）
const { data: preview } = trpc.demands.previewCopyWeek.useQuery({
  sourceWeekStart: "2026-04-14",  // 來源週週一（YYYY-MM-DD）
  targetWeekStart: "2026-04-21",  // 目標週週一（YYYY-MM-DD）
});
// 回傳：{ demands: DemandPreview[], totalCount: number }

// 複製週排班（執行）
const copyWeek = trpc.demands.copyWeek.useMutation();
await copyWeek.mutateAsync({
  sourceWeekStart: "2026-04-14",
  targetWeekStart: "2026-04-21",
});
// 回傳：{ copiedCount: number, message: string }
```

#### assignments（排班指派）

```typescript
// 查詢整週排班（週視圖用）
const { data: weekData } = trpc.assignments.listByWeek.useQuery({
  weekStart: "2026-04-14",  // 週一日期字串
});
// 回傳：{ [dateStr: string]: Assignment[] }  依台灣日期分組
// Assignment 包含：id, demandId, workerId, worker, demand, scheduledStart, scheduledEnd,
//                  actualStart, actualEnd, payType, payAmount, status

// 指派員工到需求單
const assign = trpc.assignments.assign.useMutation();
await assign.mutateAsync({
  demandId: 1,
  workerId: 5,
});

// 填寫實際工時
const fillActual = trpc.assignments.fillActual.useMutation();
await fillActual.mutateAsync({
  assignmentId: 10,
  actualStart: new Date("2026-04-18T01:00:00Z"),  // UTC 時間（台灣 09:00 = UTC 01:00）
  actualEnd: new Date("2026-04-18T10:00:00Z"),
});

// 填寫薪資
const fillPayroll = trpc.assignments.fillPayroll.useMutation();
await fillPayroll.mutateAsync({
  assignmentId: 10,
  payType: "daily",   // hourly | daily | monthly
  payAmount: 1200,
});
// ⚠️ 注意：若該月已結算（payroll_settlements），此操作會被拒絕
```

#### reports（薪資報表）

```typescript
// 取得員工月結摘要
const { data: summary } = trpc.reports.workerMonthlySummary.useQuery({
  year: 2026,
  month: 4,
});
// 回傳：WorkerMonthlySummary[]，每筆包含 workerId, workerName, totalHours, totalAmount,
//       assignmentCount, filledCount, isSettled

// 結算確認（鎖定）
const settle = trpc.reports.settle.useMutation();
await settle.mutateAsync({
  workerId: 5,
  year: 2026,
  month: 4,
  totalAmount: 36000,
});

// 解除結算（需二次確認）
const unsettle = trpc.reports.unsettle.useMutation();
await unsettle.mutateAsync({ workerId: 5, year: 2026, month: 4 });

// 批次查詢結算狀態
const { data: statuses } = trpc.reports.settlementBatchStatus.useQuery({
  year: 2026,
  month: 4,
  workerIds: [1, 2, 3, 4, 5],
});
// 回傳：{ [workerId: number]: { isSettled: boolean, settledAt?: Date, settledByName?: string } }
```

#### availability（可排班時間）

```typescript
// 取得員工某週的可排班時間
const { data: avail } = trpc.availability.getByWorkerAndWeek.useQuery({
  workerId: 5,
  weekStart: "2026-04-14",
});
// 回傳：Availability[]，每筆包含 dayOfWeek(0-6), startTime, endTime, isAvailable

// 設定可排班時間
const setAvail = trpc.availability.set.useMutation();
await setAvail.mutateAsync({
  workerId: 5,
  weekStart: "2026-04-14",
  slots: [
    { dayOfWeek: 1, startTime: "09:00", endTime: "18:00", isAvailable: true },
    { dayOfWeek: 2, startTime: "09:00", endTime: "18:00", isAvailable: true },
  ],
});
```

---

## 6. 程式碼規範

### 6.1 時區處理（最重要！）

> **核心原則：資料庫存 UTC，前端顯示用台灣時區，API 傳遞用 "YYYY-MM-DD" 字串。**

**前端必用工具函式**（位於 `client/src/lib/dateUtils.ts`）：

```typescript
// ✅ 正確：取得今日台灣日期字串
const today = getTaiwanTodayStr(); // "2026-03-08"

// ✅ 正確：將 UTC timestamp 轉為台灣日期字串
const dateStr = utcToTaiwanDateStr(assignment.scheduledStart); // "2026-03-08"

// ✅ 正確：格式化顯示日期
const display = formatTaiwanDate("2026-03-08"); // "2026/3/8"
const display = formatTaiwanDate("2026-03-08", "full"); // "2026年3月8日"

// ✅ 正確：取得本週週一
const weekStart = getTaiwanWeekStartStr(); // "2026-03-02"

// ❌ 錯誤：直接用 new Date() 的本地時間
const today = new Date().toISOString().split("T")[0]; // 可能因伺服器時區偏移

// ❌ 錯誤：用 getDay() 計算星期
const dayOfWeek = new Date().getDay(); // 應改用 getUTCDay() 或 dateUtils 函式

// ❌ 錯誤：用 toLocaleDateString() 顯示日期
const display = new Date(demand.date).toLocaleDateString("zh-TW"); // 可能時區偏移
```

**後端時區處理**（`server/db.ts`）：

後端查詢依日期篩選時，使用 MySQL 的 `CONVERT_TZ` 函式：
```sql
CONVERT_TZ(date_column, '+00:00', '+08:00') LIKE '2026-03-08%'
```

### 6.2 API 呼叫規範

```typescript
// ✅ 正確：使用 tRPC hooks
const { data, isLoading } = trpc.workers.list.useQuery();
const mutation = trpc.workers.create.useMutation({
  onSuccess: () => utils.workers.list.invalidate(),
});

// ❌ 錯誤：直接用 fetch 或 axios
const res = await fetch("/api/workers");
```

### 6.3 列表渲染的 key prop

```typescript
// ✅ 正確：使用唯一且穩定的 id
{workers.map((w) => (
  <TableRow key={w.id}>...</TableRow>
))}

// ✅ 正確：展開列使用 React.Fragment 帶 key
{workers.map((w) => (
  <React.Fragment key={w.id}>
    <TableRow>...</TableRow>
    <TableRow>...</TableRow>
  </React.Fragment>
))}

// ❌ 錯誤：用 index 作為 key（資料重排時會出問題）
{workers.map((w, i) => <TableRow key={i}>...</TableRow>)}

// ❌ 錯誤：Fragment 沒有 key
{workers.map((w) => (
  <>
    <TableRow>...</TableRow>
    <TableRow>...</TableRow>
  </>
))}
```

### 6.4 Dialog / Modal 的 defaultValue 問題

```typescript
// ❌ 錯誤：重複開啟不同資料的 Dialog 時，defaultValue 不會更新
<Input defaultValue={editingItem?.name} />

// ✅ 正確：加入 key 強制 React 重新掛載
<Input key={editingItem?.id ?? "new"} defaultValue={editingItem?.name} />

// ✅ 或改用受控元件（value + onChange）
<Input value={formName} onChange={(e) => setFormName(e.target.value)} />
```

### 6.5 Select / Combobox 的 null 值問題

```typescript
// ❌ 錯誤：clientId 可能為 null，setSelectedClientId(null) 導致顯示異常
setSelectedClientId(demand.clientId);

// ✅ 正確：null 轉為 undefined
setSelectedClientId(demand.clientId != null ? demand.clientId : undefined);
```

### 6.6 工時與金額的單位

```typescript
// 工時：資料庫以分鐘儲存，顯示時轉換
const hours = (assignment.scheduledHours / 60).toFixed(1); // "7.5"

// 金額：資料庫以整數元儲存
const amount = assignment.payAmount; // 直接使用，無需轉換
```

### 6.7 新增 tRPC Procedure 的標準流程

```typescript
// server/routers.ts
newFeature: protectedProcedure  // 需登入用 protectedProcedure，公開用 publicProcedure
  .input(z.object({
    id: z.number(),
    name: z.string().min(1),
  }))
  .mutation(async ({ ctx, input }) => {
    // 業務邏輯
    const result = await createSomething(input);
    return result;
  }),
```

---

## 7. 已知地雷與注意事項

### 7.1 時區地雷（最常踩）

**問題**：伺服器時區為 `America/New_York`（UTC-5），不是台灣時區。所有 `new Date()` 在伺服器端產生的時間都是美東時間。

**解法**：
- 前端：永遠使用 `dateUtils.ts` 的函式，不要直接用 `new Date()`
- 後端：日期比較用 `CONVERT_TZ`，不要用 `new Date().toISOString()`
- API 傳遞：日期一律傳字串 `"YYYY-MM-DD"`，不傳 `Date` 物件

**具體案例**：
- `getTaiwanTodayStr()` 而非 `new Date().toISOString().split("T")[0]`
- `utcToTaiwanDateStr(assignment.scheduledStart)` 而非 `new Date(assignment.scheduledStart).toLocaleDateString()`
- 篩選本週時，用 `getUTCDay()` 而非 `getDay()`（因為 `getTaiwanNow()` 回傳的 Date 物件是用 UTC 欄位存台灣時間）

### 7.2 tsc watch 快取問題

`pnpm dev` 的 tsc watch 模式有時會顯示舊的錯誤快取，即使程式碼已修正。**判斷方式**：執行 `npx tsc --noEmit`，若 exit code 為 0 則表示無真實錯誤。

### 7.3 月結鎖定機制

`payroll_settlements` 資料表記錄已結算的員工月份。`assignments.fillPayroll` mutation 在執行前會檢查是否已結算，若已結算則拒絕修改並回傳錯誤。解鎖需呼叫 `reports.unsettle`（需管理員權限）。

### 7.4 員工工號格式

系統沒有獨立的工號欄位，工號由 `workers.id` 格式化產生：`W-${String(id).padStart(3, "0")}`。例如 id=1 → `W-001`。

### 7.5 工作許可到期判斷

`workers.workPermitExpiryDate` 為 `null` 時表示**無期限**（不是未設定），不應顯示為「已過期」。判斷邏輯：
```typescript
const isExpired = worker.workPermitExpiryDate != null
  && new Date(worker.workPermitExpiryDate) < new Date();
```

### 7.6 需求單狀態流轉

```
draft → pending → confirmed → assigned → completed → closed
                ↘ cancelled（任何階段皆可取消）
```

`assigned` 狀態表示已有員工被指派，`completed` 表示工時已回填完成，`closed` 表示已關閉（月結後）。

### 7.7 客戶帳號與客戶資料的關聯

`users` 表中 `role = "client"` 的使用者，透過 `users.clientId` 關聯到 `clients` 表。一個客戶（`clients`）可以有多個帳號（`users`）。

---

## 8. 如何給 AI 下精準指令

### 8.1 指令結構範本

給 AI 的指令應包含以下要素：

```
【功能描述】我要做什麼
【位置說明】在哪個頁面 / 哪個元件 / 哪個 API
【資料說明】涉及哪些資料表或欄位
【行為細節】具體的互動邏輯或顯示規則
【限制條件】不能動哪些東西、需要注意什麼
```

### 8.2 精準指令範例

**不好的指令：**
> 「在報表頁面加一個匯出功能」

**好的指令：**
> 「在 `/reports` 頁面（`Reports.tsx`）的月結模式下，在現有的『下載 CSV』按鈕旁邊加一個『匯出 PDF』按鈕。PDF 內容包含：員工姓名、工號（W-001 格式）、月份、各筆指派的日期/工時/薪資，以及月結總計。使用 `@react-pdf/renderer` 套件產生 PDF，在前端直接下載，不需要後端 API。注意：月結模式的資料來自 `trpc.reports.workerMonthlySummary`，不要動到日薪模式的邏輯。」

### 8.3 時區相關指令範本

> 「在 [頁面名稱] 顯示 [欄位名稱] 時，需要轉換為台灣時區（UTC+8）。請使用 `client/src/lib/dateUtils.ts` 中的 `utcToTaiwanDateStr()` 或 `formatTaiwanDate()` 函式，不要用 `new Date().toLocaleDateString()`。」

### 8.4 新增 API 指令範本

> 「在 `server/routers.ts` 的 `[router 名稱]` router 中，新增一個名為 `[procedure 名稱]` 的 [query/mutation]。Input 為 `{ [欄位]: [型別] }`，功能是 [說明]。如果需要新的資料庫查詢，請在 `server/db.ts` 新增對應的 helper 函式。完成後執行 `npx tsc --noEmit` 確認無型別錯誤。」

### 8.5 修改 Schema 指令範本

> 「在 `drizzle/schema.ts` 的 `[資料表名稱]` 資料表中，新增 `[欄位名稱]` 欄位，型別為 `[型別]`，[可/不可]為 null，預設值為 `[預設值]`。完成後執行 `pnpm drizzle-kit generate` 產生 migration SQL，再透過 `webdev_execute_sql` 工具執行。」

### 8.6 UI 修改指令範本

> 「修改 `client/src/pages/[頁面名稱].tsx` 中的 [元件/區塊名稱]。目前的行為是 [描述現況]，期望改為 [描述目標]。注意：不要動到 [不能改的部分]。修改後確認 TypeScript 無錯誤。」

### 8.7 常見指令關鍵字

| 情境 | 建議加入的關鍵字 |
|------|-----------------|
| 時間顯示 | 「使用 `dateUtils.ts` 的函式」、「台灣時區 UTC+8」 |
| 列表渲染 | 「加入唯一的 key prop」、「使用 `React.Fragment key={...}`」 |
| 表單編輯 | 「加入 `key={editingItem?.id}` 強制重新掛載」 |
| Select 欄位 | 「注意 null 值需轉為 undefined」 |
| 工時欄位 | 「資料庫以分鐘儲存，顯示時除以 60」 |
| 月結保護 | 「檢查 `payroll_settlements` 是否已結算」 |
| 新增 API | 「在 `routers.ts` 新增 procedure，在 `db.ts` 新增 helper」 |

---

## 9. 開發流程 SOP

### 9.1 新增功能的標準步驟

```
1. 確認需求，釐清涉及的資料表和頁面
2. 如需新欄位：修改 schema.ts → generate migration → execute SQL
3. 如需新查詢：在 db.ts 新增 helper 函式
4. 在 routers.ts 新增 tRPC procedure
5. 在前端頁面呼叫 API，實作 UI
6. 執行 npx tsc --noEmit 確認無型別錯誤
7. 撰寫 vitest 測試（server/*.test.ts）
8. 執行 pnpm test 確認所有測試通過
9. 儲存 checkpoint
```

### 9.2 修 Bug 的標準步驟

```
1. 確認 bug 的觸發條件（哪個頁面、哪個操作）
2. 查看 .manus-logs/browserConsole.log 取得錯誤訊息
3. 定位問題程式碼（前端頁面 or 後端 API）
4. 修正後執行 npx tsc --noEmit
5. 在瀏覽器確認修正效果
6. 儲存 checkpoint
```

### 9.3 測試規範

測試檔案放在 `server/*.test.ts`，使用 vitest。參考 `server/auth.logout.test.ts` 的格式。

每次新增功能時，至少要測試：
- 正常流程（happy path）
- 邊界條件（空值、null、極端值）
- 錯誤處理（無效輸入、權限不足）

執行測試：
```bash
pnpm test
```

### 9.4 Checkpoint 時機

以下情況**必須**儲存 checkpoint：
- 完成一個完整功能後
- 執行 Schema migration 前
- 進行大規模重構前
- 交付給使用者前

---

## 附錄：常用指令速查

```bash
# 確認 TypeScript 無錯誤
npx tsc --noEmit

# 執行所有測試
pnpm test

# 產生 Schema migration
pnpm drizzle-kit generate

# 查看最新的瀏覽器錯誤
tail -50 .manus-logs/browserConsole.log | grep -i error

# 查看最新的 API 請求
tail -50 .manus-logs/networkRequests.log
```

---

*文件最後更新：2026/04/18*
*系統版本：worker_scheduling_system vadca51aa*

---

## 10. Manus x GitHub 同步開發指南

本章節說明如何讓新夥伴透過 Manus 連接這個 GitHub 專案，並在 Manus 的沙盒環境中直接開發、測試與部署。整個流程不需要在本機安裝任何環境。

---

### 10.1 前置條件

在開始之前，確認你已具備以下條件：

| 項目 | 說明 |
|------|------|
| Manus 帳號 | 前往 [manus.im](https://manus.im) 註冊，支援 Google 登入 |
| GitHub 帳號 | 需要有此專案的讀取（或寫入）權限 |
| 專案邀請 | 請聯繫 Samuel 取得 GitHub 協作者邀請 |

---

### 10.2 第一次連線：將 GitHub 專案匯入 Manus

**步驟一：在 Manus 建立新任務**

登入 Manus 後，點擊右上角「+ 新任務」，在對話框中輸入以下指令（直接複製貼上）：

```
請幫我從 GitHub 匯入這個專案並建立開發環境：
https://github.com/[你的組織名]/worker_scheduling_system

這是一個 React + tRPC + MySQL 的排班管理系統。
請先讀取 README.md 了解專案結構，然後安裝依賴並啟動開發伺服器。
```

> **注意**：將 `[你的組織名]` 替換為實際的 GitHub 組織或帳號名稱。

**步驟二：授權 GitHub 存取**

Manus 會自動偵測需要 GitHub 授權，並引導你完成 OAuth 連線。授權後，Manus 可以直接讀取你有權限的所有 Repository。

**步驟三：等待環境建立**

Manus 會自動執行以下動作（通常需要 2-3 分鐘）：
1. `git clone` 專案到沙盒
2. `pnpm install` 安裝所有依賴
3. 讀取 README.md 了解專案結構
4. 啟動開發伺服器（port 3000）

完成後，Manus 會提供一個臨時的預覽網址，你可以直接在瀏覽器中看到系統畫面。

---

### 10.3 日常開發流程

一旦環境建立完成，後續的開發都可以透過自然語言指令完成。以下是幾個常用的指令範本：

**拉取最新程式碼**

```
請從 GitHub 拉取最新的程式碼，並確認開發伺服器正常運行。
```

**開發新功能**

```
請參考 README.md 的第 5 章 API 清單，幫我在員工管理頁面新增「批次匯入員工」功能。
需求如下：
- 支援 CSV 格式上傳
- 欄位對應：姓名、國籍、護照號碼、合約到期日
- 匯入前顯示預覽，確認後才寫入資料庫
- 遵守 README.md 第 7 章的已知地雷（特別是時區處理）
```

**修正 Bug**

```
頁面 /workers 在篩選「本週」時顯示的資料不正確。
請參考 README.md 第 7.1 節的時區地雷，檢查 WorkerDetail.tsx 中的篩選邏輯，
確認是否使用了 getUTCDay() 而非台灣時區的星期計算。
```

**查看資料庫結構**

```
請讀取 README.md 第 3 章，告訴我 demands 資料表和 assignments 資料表之間的關聯，
以及新增一筆指派記錄時需要填入哪些必填欄位。
```

**同步程式碼到 GitHub**

```
功能開發完成，請儲存一個 checkpoint，然後將最新程式碼同步到 GitHub main branch。
Commit 訊息：feat: 新增批次匯入員工功能
```

---

### 10.4 給 AI 的高效指令原則

在 Manus 中用自然語言開發時，指令的品質直接影響結果的精準度。以下是幾個實測有效的原則：

**原則一：先指定參考文件**

每次開始新任務前，先告訴 AI 要讀哪份文件：

```
請先讀取 README.md 第 3 章（資料庫結構）和第 6 章（程式碼規範），
然後再開始實作以下功能...
```

這樣可以避免 AI 憑空猜測欄位名稱或型別，減少「改一個壞一個」的情況。

**原則二：明確指出頁面和檔案**

不要說「幫我修那個報表頁面」，要說：

```
請修改 client/src/pages/Reports.tsx 的月結模式，
在 TableBody 的 map() 中加入 key prop，
參考 README.md 第 7.3 節的 React key prop 規範。
```

**原則三：說明預期行為，不只說「修好它」**

```
目前行為：點擊「本週」篩選後，表格仍顯示所有時間的資料。
預期行為：只顯示台灣時區本週一到週日（含）的指派記錄。
注意：請使用 dateUtils.ts 中的 getTaiwanWeekStartStr() 計算週起始日，
不要使用 getUTCDay()（參考 README.md 第 7.1 節）。
```

**原則四：要求 AI 在修改前說明計畫**

```
在開始修改程式碼之前，請先說明你打算改哪些檔案、改什麼邏輯，
讓我確認方向正確後再執行。
```

**原則五：每次完成後要求儲存 checkpoint**

```
功能確認沒問題後，請執行以下動作：
1. 執行 pnpm test 確認測試全過
2. 執行 npx tsc --noEmit 確認 TypeScript 無錯誤
3. 儲存 checkpoint
4. 同步到 GitHub
```

---

### 10.5 常見問題排解

| 問題 | 可能原因 | 解法 |
|------|----------|------|
| 開發伺服器無法啟動 | 環境變數未設定 | 告訴 Manus：「請檢查 .env 設定，確認 DATABASE_URL 和 JWT_SECRET 已設定」 |
| 資料庫連線失敗 | TiDB/MySQL 連線字串錯誤 | 告訴 Manus：「請讀取 README.md 附錄的常用指令，執行資料庫連線測試」 |
| TypeScript 編譯錯誤 | 型別不符或 import 缺失 | 告訴 Manus：「請執行 npx tsc --noEmit，列出所有錯誤並一次修正」 |
| 時間顯示不正確 | 時區計算錯誤 | 參考 README.md 第 7.1 節，確認使用 dateUtils.ts 的台灣時區函式 |
| 修改後畫面沒更新 | Vite HMR 快取 | 告訴 Manus：「請重新啟動開發伺服器」 |
| GitHub 推送失敗 | 分支保護或衝突 | 告訴 Manus：「請說明推送失敗的原因，並協助解決衝突」 |

---

### 10.6 專案維護建議

為了讓多人協作順暢，建議遵守以下慣例：

**每次開發前**：先告訴 Manus 拉取最新程式碼，避免在舊版本上開發。

**每次完成功能後**：儲存 checkpoint 並同步 GitHub，讓其他人能看到最新進度。

**遇到不確定的修改**：先問 Manus「這樣改會影響哪些地方？」，再決定是否執行。

**重大修改前**：先儲存 checkpoint，萬一出問題可以直接回滾，不需要手動還原程式碼。

---

> **小提醒**：Manus 的沙盒環境是隔離的，每個任務都有獨立的執行環境。如果你開了一個新任務，需要重新告訴 Manus 從 GitHub 匯入專案。建議把常用的初始化指令存成文字檔，方便每次快速貼上。
