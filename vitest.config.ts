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
    // 測試時強制清空 DATABASE_URL，防止測試連線正式資料庫。
    // 需要 DB 的測試應在 beforeEach/beforeAll 中檢查 DB 可用性，不可用時自動 skip。
    env: {
      DATABASE_URL: "",
    },
  },
});
