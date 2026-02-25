import { invokeLLM } from "./_core/llm";

/**
 * 工作許可證 OCR 辨識結果
 */
export interface WorkPermitOCRResult {
  name: string; // 姓名
  nationality: string; // 國籍
  passportNo: string; // 護照號碼
  validityPeriodStart: string; // 許可期間開始（民國年月日，例如：114/9/23）
  validityPeriodEnd: string; // 許可期間結束（民國年月日，例如：115/9/16）
  issuedDate: string; // 核發日期（民國年月日，例如：114/9/23）
  documentNo: string; // 許可文號
  uiNumber: string; // 統一證號
  school: string; // 就讀學校
}

/**
 * 使用 LLM Vision API 辨識工作許可證圖片
 * @param imageUrl 圖片的公開 URL（S3 URL）
 * @returns OCR 辨識結果
 */
export async function recognizeWorkPermit(
  imageUrl: string
): Promise<WorkPermitOCRResult> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "你是一個專業的 OCR 辨識助手，專門辨識台灣勞動部核發的工作許可證文件。",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `請辨識這張台灣勞動部核發的「外國留學生、僑生及華僑學生工作許可」文件，並提取以下資訊：

1. 姓名（Name）
2. 國籍/地區（nationality/region）
3. 護照號碼（Passport No.）
4. 許可期間（Validity Period）- 請分別提取開始日期和結束日期，格式為民國年月日（例如：114/9/23）
5. 核發日期（Issued Date）- 格式為民國年月日（例如：114/9/23）
6. 許可文號（Document No.）
7. 統一證號（UI No.）
8. 就讀學校（School）

請以 JSON 格式回傳，欄位名稱如下：
{
  "name": "姓名",
  "nationality": "國籍",
  "passportNo": "護照號碼",
  "validityPeriodStart": "許可期間開始日期（民國年月日）",
  "validityPeriodEnd": "許可期間結束日期（民國年月日）",
  "issuedDate": "核發日期（民國年月日）",
  "documentNo": "許可文號",
  "uiNumber": "統一證號",
  "school": "就讀學校"
}

如果某個欄位無法辨識，請填入空字串 ""。
請確保日期格式為民國年月日（例如：114/9/23），不要轉換為西元年。`,
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high",
              },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "work_permit_ocr",
          strict: true,
          schema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "姓名",
              },
              nationality: {
                type: "string",
                description: "國籍",
              },
              passportNo: {
                type: "string",
                description: "護照號碼",
              },
              validityPeriodStart: {
                type: "string",
                description: "許可期間開始日期（民國年月日，例如：114/9/23）",
              },
              validityPeriodEnd: {
                type: "string",
                description: "許可期間結束日期（民國年月日，例如：115/9/16）",
              },
              issuedDate: {
                type: "string",
                description: "核發日期（民國年月日，例如：114/9/23）",
              },
              documentNo: {
                type: "string",
                description: "許可文號",
              },
              uiNumber: {
                type: "string",
                description: "統一證號",
              },
              school: {
                type: "string",
                description: "就讀學校",
              },
            },
            required: [
              "name",
              "nationality",
              "passportNo",
              "validityPeriodStart",
              "validityPeriodEnd",
              "issuedDate",
              "documentNo",
              "uiNumber",
              "school",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("OCR 辨識失敗：API 未返回內容");
    }

    // 如果 content 是陣列，提取第一個 text 元素
    const contentText = typeof content === "string" 
      ? content 
      : content.find(c => c.type === "text")?.text || "";

    if (!contentText) {
      throw new Error("OCR 辨識失敗：無法提取文字內容");
    }

    const ocrResult: WorkPermitOCRResult = JSON.parse(contentText);
    return ocrResult;
  } catch (error) {
    console.error("OCR 辨識失敗：", error);
    throw new Error(
      `OCR 辨識失敗：${error instanceof Error ? error.message : "未知錯誤"}`
    );
  }
}
