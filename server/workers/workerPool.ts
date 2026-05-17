/**
 * server/workers/workerPool.ts
 *
 * Worker Thread 執行器：管理 feasibilityWorker 的生命週期。
 *
 * 設計決策：
 *   - 使用「按需建立、用完即棄」模式（Stateless Worker），而非長駐 Thread Pool。
 *     原因：本系統的 feasibility 計算是 I/O 密集（DB 查詢）+ 少量 CPU，
 *     Worker Thread 主要用於卸載 CPU 計算避免阻塞 event loop，
 *     而非追求極致吞吐量。按需建立可避免 Thread Pool 的複雜性與記憶體開銷。
 *   - 設有 5 秒超時保護，超時自動 fallback 至主執行緒同步計算。
 *   - 生產環境（esbuild bundle）使用 __filename 定位 Worker 腳本；
 *     開發環境（tsx）使用 tsx register 動態轉譯 TypeScript。
 *
 * 使用方式：
 *   import { runFeasibilityWorker } from "./workers/workerPool";
 *   const result = await runFeasibilityWorker(input);
 */

import { Worker } from "worker_threads";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import type { FeasibilityInput, FeasibilityOutput } from "./feasibilityWorker.js";

// ─── 路徑解析 ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 判斷目前是否為 production（esbuild bundle）模式。
 * production 時 __filename 會是 dist/index.js，Worker 腳本已被 bundle 進去，
 * 需要改用 eval 方式執行（或另外 bundle worker）。
 *
 * 本實作採用「開發用 tsx、production 用 inline eval」的雙模式策略：
 *   - 開發：tsx watch 模式，直接 require tsx/register 執行 .ts 檔
 *   - Production：esbuild 將 worker 腳本 bundle 為獨立 JS 字串，以 eval 執行
 *
 * 注意：由於 esbuild 的 bundle 機制，production 模式暫時 fallback 至主執行緒。
 * 如需在 production 完整啟用 Worker Thread，需將 worker 腳本單獨 bundle。
 */
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const WORKER_TIMEOUT_MS = 5000;

// ─── Worker 執行函式 ─────────────────────────────────────────────────────────

/**
 * 在 Worker Thread 中執行 feasibility 計算。
 * 若 Worker Thread 不可用（production bundle 限制）或超時，自動 fallback。
 */
export async function runFeasibilityWorker(
  input: FeasibilityInput
): Promise<FeasibilityOutput> {
  if (IS_PRODUCTION) {
    // Production 模式：Worker Thread 需要獨立 bundle，暫時 fallback 至主執行緒
    // TODO: 若需要在 production 完整啟用，需在 build script 中單獨 bundle worker
    return computeInline(input);
  }

  return new Promise<FeasibilityOutput>((resolve, reject) => {
    const workerPath = path.join(__dirname, "feasibilityWorker.ts");

    // 開發模式：使用 tsx 動態轉譯 TypeScript Worker
    const worker = new Worker(
      `
      import { register } from 'node:module';
      import { pathToFileURL } from 'node:url';
      register('tsx/esm', pathToFileURL('./'));
      await import(${JSON.stringify(pathToFileURL(workerPath).href)});
      `,
      {
        eval: true,
        workerData: input,
      }
    );

    const timer = setTimeout(() => {
      worker.terminate();
      // 超時 fallback 至主執行緒
      computeInline(input).then(resolve).catch(reject);
    }, WORKER_TIMEOUT_MS);

    worker.once("message", (msg: { ok: boolean; result?: FeasibilityOutput; error?: string }) => {
      clearTimeout(timer);
      if (msg.ok && msg.result) {
        resolve(msg.result);
      } else {
        // Worker 計算錯誤，fallback 至主執行緒
        computeInline(input).then(resolve).catch(reject);
      }
    });

    worker.once("error", () => {
      clearTimeout(timer);
      // Worker 啟動失敗，fallback 至主執行緒
      computeInline(input).then(resolve).catch(reject);
    });
  });
}

// ─── Inline Fallback（主執行緒同步計算）────────────────────────────────────

/**
 * 主執行緒 fallback 計算（與 feasibilityWorker.ts 的 compute 函式邏輯相同）。
 * 確保在 Worker Thread 不可用時系統仍能正常運作。
 */
async function computeInline(input: FeasibilityInput): Promise<FeasibilityOutput> {
  const { compute } = await import("./feasibilityWorker.js");
  return compute(input);
}
