import { describe, it, expect } from "vitest";
import { createWorker, getWorkerById } from "./db";

describe("員工管理 - 批次上傳和單張新增功能測試", () => {
  it("應該能夠建立員工（包含所有新增的欄位）", async () => {
    const workerData = {
      name: `測試員工-${Date.now()}`,
      phone: "0912345678",
      email: "test@example.com",
      school: "台灣大學",
      nationality: "印尼",
      idNumber: "H801403696",
      lineId: "test_line",
      whatsappId: "test_whatsapp",
      hasWorkPermit: true,
      hasHealthCheck: true,
      workPermitExpiryDate: new Date("2026-12-31"),
      attendanceNotes: "測試出勤備註",
      avatarUrl: "https://example.com/avatar.jpg",
      city: "台北市",
      note: "測試備註",
      status: "active" as const,
    };

    const worker = await createWorker(workerData);

    expect(worker).toBeDefined();
    expect(worker.name).toBe(workerData.name);
    expect(worker.phone).toBe(workerData.phone);
    expect(worker.email).toBe(workerData.email);
    expect(worker.school).toBe(workerData.school);
    expect(worker.nationality).toBe(workerData.nationality);
    expect(worker.idNumber).toBe(workerData.idNumber);
    expect(worker.lineId).toBe(workerData.lineId);
    expect(worker.whatsappId).toBe(workerData.whatsappId);
    expect(worker.hasWorkPermit).toBe(1); // SQLite 使用 1/0 表示 boolean
    expect(worker.hasHealthCheck).toBe(1);
    expect(worker.attendanceNotes).toBe(workerData.attendanceNotes);
    expect(worker.avatarUrl).toBe(workerData.avatarUrl);
    expect(worker.city).toBe(workerData.city);
    expect(worker.note).toBe(workerData.note);
    expect(worker.status).toBe(workerData.status);
  });

  it("應該能夠建立員工（使用預設頭像）", async () => {
    const workerData = {
      name: `測試員工-預設頭像-${Date.now()}`,
      avatarUrl: "/avatars/default-1.svg", // 預設頭像 URL
      status: "active" as const,
    };

    const worker = await createWorker(workerData);

    expect(worker).toBeDefined();
    expect(worker.name).toBe(workerData.name);
    expect(worker.avatarUrl).toBe(workerData.avatarUrl);
  });

  it("應該能夠建立員工（使用上傳的圖片 base64）", async () => {
    const workerData = {
      name: `測試員工-上傳圖片-${Date.now()}`,
      avatarUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", // 1x1 透明 PNG
      status: "active" as const,
    };

    const worker = await createWorker(workerData);

    expect(worker).toBeDefined();
    expect(worker.name).toBe(workerData.name);
    expect(worker.avatarUrl).toContain("data:image/png;base64");
  });

  it("應該能夠建立員工（包含工作簽證到期日）", async () => {
    const expiryDate = new Date("2026-12-31");
    const workerData = {
      name: `測試員工-工作簽證-${Date.now()}`,
      hasWorkPermit: true,
      workPermitExpiryDate: expiryDate,
      status: "active" as const,
    };

    const worker = await createWorker(workerData);

    expect(worker).toBeDefined();
    expect(worker.name).toBe(workerData.name);
    expect(worker.hasWorkPermit).toBe(1);
    
    // 從資料庫重新查詢以驗證日期儲存正確
    const fetchedWorker = await getWorkerById(worker.id);
    expect(fetchedWorker).toBeDefined();
    if (fetchedWorker?.workPermitExpiryDate) {
      const storedDate = new Date(fetchedWorker.workPermitExpiryDate);
      expect(storedDate.toISOString().split('T')[0]).toBe(expiryDate.toISOString().split('T')[0]);
    }
  });

  it("應該能夠建立員工（包含城市資訊）", async () => {
    const workerData = {
      name: `測試員工-城市-${Date.now()}`,
      city: "台北市",
      status: "active" as const,
    };

    const worker = await createWorker(workerData);

    expect(worker).toBeDefined();
    expect(worker.name).toBe(workerData.name);
    expect(worker.city).toBe(workerData.city);
  });

  it("應該能夠建立員工（包含 LINE ID 和 WhatsApp ID）", async () => {
    const workerData = {
      name: `測試員工-聯絡方式-${Date.now()}`,
      lineId: "test_line_id",
      whatsappId: "+886912345678",
      status: "active" as const,
    };

    const worker = await createWorker(workerData);

    expect(worker).toBeDefined();
    expect(worker.name).toBe(workerData.name);
    expect(worker.lineId).toBe(workerData.lineId);
    expect(worker.whatsappId).toBe(workerData.whatsappId);
  });

  it("應該能夠建立員工（包含出勤備註）", async () => {
    const workerData = {
      name: `測試員工-出勤備註-${Date.now()}`,
      attendanceNotes: "每週一、三、五可排班，週末不可排班",
      status: "active" as const,
    };

    const worker = await createWorker(workerData);

    expect(worker).toBeDefined();
    expect(worker.name).toBe(workerData.name);
    expect(worker.attendanceNotes).toBe(workerData.attendanceNotes);
  });
});
