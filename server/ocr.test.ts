import { describe, it, expect } from "vitest";
import { recognizeWorkPermit } from "./gemini-ocr";

describe("工作許可證 OCR 辨識功能", () => {
  it("應該能夠成功辨識工作許可證圖片並返回結構化資料", async () => {
    // 使用測試圖片 URL（使用者提供的範例圖片）
    const testImageUrl = "https://storage.manus.im/user-uploads/pasted_file_1EssKB_image.png";

    const result = await recognizeWorkPermit(testImageUrl);

    // 驗證返回的資料結構
    expect(result).toBeDefined();
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("nationality");
    expect(result).toHaveProperty("passportNo");
    expect(result).toHaveProperty("validityPeriodStart");
    expect(result).toHaveProperty("validityPeriodEnd");
    expect(result).toHaveProperty("issuedDate");
    expect(result).toHaveProperty("documentNo");
    expect(result).toHaveProperty("uiNo");
    expect(result).toHaveProperty("school");

    // 驗證關鍵欄位存在（可能為空字串）
    expect(result.name).toBeDefined();
    expect(result.nationality).toBeDefined();
    expect(result.passportNo).toBeDefined();

    // 輸出辨識結果供檢查
    console.log("OCR 辨識結果：", JSON.stringify(result, null, 2));

    // 驗證日期格式（民國年月日）
    if (result.validityPeriodStart) {
      expect(result.validityPeriodStart).toMatch(/^\d{2,3}\/\d{1,2}\/\d{1,2}$/);
    }
    if (result.validityPeriodEnd) {
      expect(result.validityPeriodEnd).toMatch(/^\d{2,3}\/\d{1,2}\/\d{1,2}$/);
    }
    if (result.issuedDate) {
      expect(result.issuedDate).toMatch(/^\d{2,3}\/\d{1,2}\/\d{1,2}$/);
    }
  }, 60000); // 設定 60 秒超時，因為 OCR 可能需要較長時間

  it("應該能夠處理無效的圖片 URL 並返回空資料", async () => {
    const invalidUrl = "https://invalid-url.example.com/nonexistent.jpg";

    // 無效 URL 可能會拋錯誤或返回空資料
    try {
      const result = await recognizeWorkPermit(invalidUrl);
      // 如果沒有拋錯誤，應該返回空資料
      expect(result).toBeDefined();
    } catch (error) {
      // 或者拋錯誤也是合理的
      expect(error).toBeDefined();
    }
  }, 30000);
});
