import { describe, it, expect } from "vitest";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ENV } from "./_core/env";

describe("Gemini API 金鑰驗證", () => {
  it("應該能夠列出可用的 Gemini 模型", async () => {
    // 檢查 API 金鑰是否存在
    expect(ENV.geminiApiKey).toBeTruthy();
    expect(ENV.geminiApiKey.length).toBeGreaterThan(0);

    // 初始化 Gemini API
    const genAI = new GoogleGenerativeAI(ENV.geminiApiKey);

    // 列出可用的模型
    const models = await genAI.listModels();
    
    console.log("可用的 Gemini 模型：");
    for (const model of models) {
      console.log(`- ${model.name} (${model.displayName})`);
    }

    // 驗證至少有一個模型可用
    expect(models.length).toBeGreaterThan(0);
  }, 30000);

  it("應該能夠使用 Gemini 模型進行簡單的文字生成測試", async () => {
    // 初始化 Gemini API
    const genAI = new GoogleGenerativeAI(ENV.geminiApiKey);
    
    // 嘗試使用 gemini-2.0-flash-exp 模型（最新的模型）
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    // 進行簡單的文字生成測試
    const result = await model.generateContent("Say hello in one word");
    const response = result.response;
    const text = response.text();

    // 驗證回應
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
    console.log("Gemini API 測試成功，回應：", text);
  }, 30000);
});
