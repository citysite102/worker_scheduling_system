import { describe, it, expect } from "vitest";

// ─── 工作種類過濾邏輯測試 ──────────────────────────────────────────────────────

/**
 * 模擬 DemandDetail.tsx 中的工作種類篩選邏輯
 * filterJobCategory: "all" | "match" | "<categoryId>"
 */
function filterWorkerByJobCategory(
  workerId: number,
  filterJobCategory: string,
  requiredJobCategoryId: number | null | undefined,
  workerCategoryMap: Record<number, number[]>
): boolean {
  if (filterJobCategory === "all") return true;

  if (filterJobCategory === "match") {
    if (!requiredJobCategoryId) return true; // 無需求限制，全部通過
    const workerCats = workerCategoryMap[workerId] || [];
    return workerCats.includes(requiredJobCategoryId);
  }

  // 指定種類 ID
  const catId = Number(filterJobCategory);
  if (isNaN(catId)) return true;
  const workerCats = workerCategoryMap[workerId] || [];
  return workerCats.includes(catId);
}

describe("工作種類篩選邏輯", () => {
  const workerCategoryMap: Record<number, number[]> = {
    1: [10, 20], // 員工 1：房務 + 看護
    2: [10],     // 員工 2：房務
    3: [30],     // 員工 3：餐飲
    4: [],       // 員工 4：無工作種類
  };

  it("filterJobCategory=all 時所有員工都通過", () => {
    expect(filterWorkerByJobCategory(1, "all", 10, workerCategoryMap)).toBe(true);
    expect(filterWorkerByJobCategory(4, "all", 10, workerCategoryMap)).toBe(true);
  });

  it("filterJobCategory=match 且需求需要房務(10)，只有有房務的員工通過", () => {
    expect(filterWorkerByJobCategory(1, "match", 10, workerCategoryMap)).toBe(true);
    expect(filterWorkerByJobCategory(2, "match", 10, workerCategoryMap)).toBe(true);
    expect(filterWorkerByJobCategory(3, "match", 10, workerCategoryMap)).toBe(false);
    expect(filterWorkerByJobCategory(4, "match", 10, workerCategoryMap)).toBe(false);
  });

  it("filterJobCategory=match 且需求無工作種類限制，所有員工都通過", () => {
    expect(filterWorkerByJobCategory(1, "match", null, workerCategoryMap)).toBe(true);
    expect(filterWorkerByJobCategory(4, "match", null, workerCategoryMap)).toBe(true);
  });

  it("filterJobCategory=指定 ID(20) 時，只有有該種類的員工通過", () => {
    expect(filterWorkerByJobCategory(1, "20", 10, workerCategoryMap)).toBe(true);
    expect(filterWorkerByJobCategory(2, "20", 10, workerCategoryMap)).toBe(false);
    expect(filterWorkerByJobCategory(3, "20", 10, workerCategoryMap)).toBe(false);
  });

  it("filterJobCategory=指定 ID(30) 時，只有餐飲員工通過", () => {
    expect(filterWorkerByJobCategory(3, "30", null, workerCategoryMap)).toBe(true);
    expect(filterWorkerByJobCategory(1, "30", null, workerCategoryMap)).toBe(false);
  });

  it("無效的 filterJobCategory 值不過濾（通過）", () => {
    expect(filterWorkerByJobCategory(1, "invalid", 10, workerCategoryMap)).toBe(true);
  });
});

// ─── getWorkerCategoryMap 邏輯測試 ──────────────────────────────────────────

/**
 * 模擬 getWorkerCategoryMap 的聚合邏輯
 */
function buildWorkerCategoryMap(
  rows: Array<{ workerId: number; jobCategoryId: number }>
): Record<number, number[]> {
  const map: Record<number, number[]> = {};
  for (const row of rows) {
    if (!map[row.workerId]) map[row.workerId] = [];
    map[row.workerId].push(row.jobCategoryId);
  }
  return map;
}

describe("getWorkerCategoryMap 聚合邏輯", () => {
  it("空資料回傳空 Map", () => {
    expect(buildWorkerCategoryMap([])).toEqual({});
  });

  it("單一員工單一種類", () => {
    const result = buildWorkerCategoryMap([{ workerId: 1, jobCategoryId: 10 }]);
    expect(result).toEqual({ 1: [10] });
  });

  it("單一員工多種類", () => {
    const result = buildWorkerCategoryMap([
      { workerId: 1, jobCategoryId: 10 },
      { workerId: 1, jobCategoryId: 20 },
    ]);
    expect(result[1]).toContain(10);
    expect(result[1]).toContain(20);
    expect(result[1].length).toBe(2);
  });

  it("多員工各自種類不互相干擾", () => {
    const result = buildWorkerCategoryMap([
      { workerId: 1, jobCategoryId: 10 },
      { workerId: 2, jobCategoryId: 20 },
      { workerId: 3, jobCategoryId: 30 },
    ]);
    expect(result[1]).toEqual([10]);
    expect(result[2]).toEqual([20]);
    expect(result[3]).toEqual([30]);
  });

  it("未出現在 Map 中的員工回傳 undefined（前端以 || [] 處理）", () => {
    const result = buildWorkerCategoryMap([{ workerId: 1, jobCategoryId: 10 }]);
    expect(result[999]).toBeUndefined();
    expect(result[999] || []).toEqual([]);
  });
});

// ─── 需求類型所需工作種類標示邏輯 ──────────────────────────────────────────────

describe("需求類型所需工作種類標示邏輯", () => {
  const jobCategories = [
    { id: 10, name: "房務", color: "#3B82F6" },
    { id: 20, name: "看護", color: "#10B981" },
    { id: 30, name: "餐飲", color: "#F59E0B" },
  ];

  function shouldShowCategoryBadge(
    workerId: number,
    requiredCatId: number | null | undefined,
    workerCategoryMap: Record<number, number[]>
  ): boolean {
    if (!requiredCatId) return false;
    const workerCats = workerCategoryMap[workerId] || [];
    return workerCats.includes(requiredCatId);
  }

  const workerCategoryMap = { 1: [10, 20], 2: [10], 3: [30], 4: [] };

  it("需求無工作種類要求時不顯示標籤", () => {
    expect(shouldShowCategoryBadge(1, null, workerCategoryMap)).toBe(false);
    expect(shouldShowCategoryBadge(1, undefined, workerCategoryMap)).toBe(false);
  });

  it("員工符合需求工作種類時顯示標籤", () => {
    expect(shouldShowCategoryBadge(1, 10, workerCategoryMap)).toBe(true);
    expect(shouldShowCategoryBadge(2, 10, workerCategoryMap)).toBe(true);
  });

  it("員工不符合需求工作種類時不顯示標籤", () => {
    expect(shouldShowCategoryBadge(3, 10, workerCategoryMap)).toBe(false);
    expect(shouldShowCategoryBadge(4, 10, workerCategoryMap)).toBe(false);
  });

  it("正確找到對應的工作種類顏色", () => {
    const cat = jobCategories.find(c => c.id === 10);
    expect(cat?.color).toBe("#3B82F6");
    expect(cat?.name).toBe("房務");
  });
});
