import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],

    // 自動注入 VITEST=true，讓 test-env-guard.ts 可以偵測執行環境
    env: {
      VITEST: "true",
    },

    // 優先載入 .env.test，若不存在則 fallback 到 .env
    // .env.test 應設定 TEST_DATABASE_URL 指向測試專用資料庫
    // 注意：.env.test 不應提交到 Git（已加入 .gitignore）
    envDir: templateRoot,

    // 每個測試檔案獨立執行，避免跨測試污染
    isolate: true,

    // 測試逾時設定（資料庫操作可能較慢）
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
