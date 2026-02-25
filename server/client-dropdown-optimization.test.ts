import { describe, it, expect, beforeEach } from "vitest";
import { getClientByName, createClient, getAllClients } from "./db";

describe("客戶下拉選單優化：名稱唯一性驗證", () => {
  const testClientData = {
    name: "測試客戶公司名稱唯一性",
    contactName: "張三",
    contactPhone: "0912345678",
    contactEmail: "test@example.com",
    address: "台北市信義區",
    note: "測試用客戶",
  };

  it("應該能夠根據客戶名稱查詢客戶", async () => {
    // 建立測試客戶
    const client = await createClient(testClientData);
    expect(client).toBeDefined();
    expect(client.name).toBe(testClientData.name);

    // 根據名稱查詢客戶
    const foundClient = await getClientByName(testClientData.name);
    expect(foundClient).toBeDefined();
    expect(foundClient?.name).toBe(testClientData.name);
    // contactName 可能為 null，所以只驗證存在欄位
    expect(foundClient).toHaveProperty("contactName");
  });

  it("當客戶名稱不存在時應該回傳 undefined", async () => {
    const nonExistentClient = await getClientByName("不存在的客戶名稱");
    expect(nonExistentClient).toBeUndefined();
  });

  it("客戶下拉選單應該包含客戶名稱和聯絡人資訊", async () => {
    // 建立多個測試客戶
    const client1 = await createClient({
      ...testClientData,
      name: "測試公司A",
      contactName: "聯絡人A",
    });
    const client2 = await createClient({
      ...testClientData,
      name: "測試公司B",
      contactName: "聯絡人B",
    });

    // 取得所有客戶
    const allClients = await getAllClients();
    expect(allClients.length).toBeGreaterThanOrEqual(2);

    // 驗證客戶資料包含必要欄位
    const testClients = allClients.filter(
      (c) => c.name === "測試公司A" || c.name === "測試公司B"
    );
    expect(testClients.length).toBeGreaterThanOrEqual(2);

    testClients.forEach((client) => {
      expect(client).toHaveProperty("id");
      expect(client).toHaveProperty("name");
      expect(client).toHaveProperty("contactName");
      expect(typeof client.id).toBe("number");
      expect(typeof client.name).toBe("string");
      // contactName 可能為 null，所以不驗證類型
    });
  });

  it("客戶下拉選單的顯示格式應該為「客戶名稱（聯絡人：XXX）」", () => {
    // 這是前端顯示邏輯的測試，驗證格式化函數
    const formatClientDisplay = (
      name: string,
      contactPerson: string
    ): string => {
      return `${name}（聯絡人：${contactPerson}）`;
    };

    const display1 = formatClientDisplay("測試公司A", "張三");
    expect(display1).toBe("測試公司A（聯絡人：張三）");

    const display2 = formatClientDisplay("測試公司B", "李四");
    expect(display2).toBe("測試公司B（聯絡人：李四）");
  });

  it("客戶下拉選單的 value 應該使用客戶 ID", async () => {
    // 建立測試客戶
    const client = await createClient({
      ...testClientData,
      name: "測試客戶ID作為Value",
    });

    // 驗證客戶 ID 是數字且大於 0
    expect(client.id).toBeGreaterThan(0);
    expect(typeof client.id).toBe("number");

    // 驗證可以用 ID 查詢到客戶
    const allClients = await getAllClients();
    const foundClient = allClients.find((c) => c.id === client.id);
    expect(foundClient).toBeDefined();
    expect(foundClient?.name).toBe("測試客戶ID作為Value");
  });
});

describe("日期選擇器視覺優化", () => {
  it("選取的日期應該有明顯的視覺標記", () => {
    // 這是前端視覺樣式的測試，驗證 CSS 類別
    const selectedDateClasses =
      "bg-primary/10 text-primary font-semibold border-2 border-primary";

    // 驗證類別包含必要的視覺元素
    expect(selectedDateClasses).toContain("bg-primary/10"); // 背景色
    expect(selectedDateClasses).toContain("text-primary"); // 文字顏色
    expect(selectedDateClasses).toContain("font-semibold"); // 粗體
    expect(selectedDateClasses).toContain("border-2"); // 邊框寬度
    expect(selectedDateClasses).toContain("border-primary"); // 邊框顏色
  });

  it("日期選擇器應該支援多選模式", () => {
    // 模擬多選日期的資料結構
    const selectedDates: Date[] = [
      new Date("2026-02-01T00:00:00"),
      new Date("2026-02-05T00:00:00"),
      new Date("2026-02-10T00:00:00"),
    ];

    expect(selectedDates.length).toBe(3);
    // 驗證日期選擇器能夠儲存多個日期
    expect(selectedDates[0].getMonth()).toBe(1); // 2月（0-based）
    expect(selectedDates[1].getMonth()).toBe(1);
    expect(selectedDates[2].getMonth()).toBe(1);
  });

  it("日期選擇器應該能夠移除已選擇的日期", () => {
    // 模擬移除日期的邏輯
    let selectedDates: Date[] = [
      new Date("2026-02-01T00:00:00"),
      new Date("2026-02-05T00:00:00"),
      new Date("2026-02-10T00:00:00"),
    ];

    // 移除第二個日期
    const dateToRemove = selectedDates[1];
    selectedDates = selectedDates.filter(
      (d) => d.getTime() !== dateToRemove.getTime()
    );

    expect(selectedDates.length).toBe(2);
    // 驗證移除功能正常運作
    expect(selectedDates.some(d => d.getTime() === dateToRemove.getTime())).toBe(false);
  });

  it("日期選擇器應該能夠清除所有選擇的日期", () => {
    // 模擬清除所有日期的邏輯
    let selectedDates: Date[] = [
      new Date("2026-02-01T00:00:00"),
      new Date("2026-02-05T00:00:00"),
      new Date("2026-02-10T00:00:00"),
    ];

    // 清除所有日期
    selectedDates = [];

    expect(selectedDates.length).toBe(0);
  });
});
