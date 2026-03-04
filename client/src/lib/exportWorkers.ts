/**
 * 批次匯出員工資料為 CSV 格式
 */

export interface WorkerExportData {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  school?: string | null;
  nationality?: string | null;
  idNumber?: string | null;
  hasWorkPermit: number;
  hasHealthCheck: number;
  workPermitExpiryDate?: Date | null;
  attendanceNotes?: string | null;
  lineId?: string | null;
  whatsappId?: string | null;
  status: "active" | "inactive";
  note?: string | null;
  createdAt: Date;
}

/**
 * 將員工資料陣列轉換為 CSV 格式並下載
 */
export function exportWorkersToCSV(workers: WorkerExportData[], filename = "員工資料.csv") {
  // CSV 標題行
  const headers = [
    "員工編號",
    "姓名",
    "電話",
    "Email",
    "學校",
    "國籍",
    "統一證號",
    "工作簽證",
    "體檢",
    "工作許可到期日",
    "Line ID",
    "WhatsApp ID",
    "狀態",
    "出勤記錄",
    "備註",
    "建立日期"
  ];

  // 將資料轉換為 CSV 行
  const rows = workers.map(worker => [
    worker.id.toString(),
    worker.name,
    worker.phone || "",
    worker.email || "",
    worker.school || "",
    worker.nationality || "",
    worker.idNumber || "",
    worker.hasWorkPermit === 1 ? "有" : "無",
    worker.hasHealthCheck === 1 ? "有" : "無",
    worker.workPermitExpiryDate 
      ? new Date(worker.workPermitExpiryDate).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/') 
      : "",
    worker.lineId || "",
    worker.whatsappId || "",
    worker.status === "active" ? "啟用" : "停用",
    worker.attendanceNotes || "",
    worker.note || "",
    new Date(worker.createdAt).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/')
  ]);

  // 組合 CSV 內容
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  // 加入 BOM 以支援 Excel 正確顯示中文
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });

  // 建立下載連結
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
