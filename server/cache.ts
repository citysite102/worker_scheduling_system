/**
 * server/cache.ts
 * 輕量級 LRU Cache 模組，支援 TTL 和 tag-based 批次清除
 * 用於快速配對 API 的結果快取（60s TTL）
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tags: string[];
}

class LRUCache<T> {
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(maxSize = 500, defaultTtlMs = 60_000) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    // LRU：將命中的 entry 移到 Map 末尾（最近使用）
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, tags: string[] = [], ttlMs?: number): void {
    // 若已存在，先刪除再重設（更新 LRU 順序）
    if (this.store.has(key)) {
      this.store.delete(key);
    }

    // 超過容量時，刪除最舊的 entry（Map 的第一個元素）
    if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
      tags,
    });
  }

  /** 依 tag 批次清除（例如：清除所有與特定 workerId 或 demandId 相關的快取） */
  invalidateByTag(tag: string): number {
    let count = 0;
    const keysToDelete: string[] = [];
    this.store.forEach((entry, key) => {
      if (entry.tags.includes(tag)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => {
      this.store.delete(key);
      count++;
    });
    return count;
  }

  /** 清除所有過期 entry */
  purgeExpired(): number {
    const now = Date.now();
    let count = 0;
    const keysToDelete: string[] = [];
    this.store.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => {
      this.store.delete(key);
      count++;
    });
    return count;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  /** 快取命中率統計（開發用） */
  private hits = 0;
  private misses = 0;

  recordHit(): void { this.hits++; }
  recordMiss(): void { this.misses++; }

  getStats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : 'N/A',
      size: this.store.size,
    };
  }
}

// 快速配對的兩個 API 共用一個 cache 實例
// maxSize=500：最多快取 500 個查詢結果（員工數 × 需求數的組合）
// defaultTtlMs=60_000：預設 60 秒 TTL
export const dispatchCache = new LRUCache<unknown>(500, 60_000);

/** 產生 getMatchingWorkers 的快取 key */
export function matchingWorkersKey(demandId: number): string {
  return `mw:${demandId}`;
}

/** 產生 getMatchingDemands 的快取 key */
export function matchingDemandsKey(
  workerId: number,
  dateFrom: string,
  dateTo: string
): string {
  return `md:${workerId}:${dateFrom}:${dateTo}`;
}

/** 指派成功後，清除與該 demandId 和 workerId 相關的所有快取 */
export function invalidateDispatchCache(demandId: number, workerId: number): void {
  // 清除需求視角快取（demandId 變動）
  dispatchCache.invalidateByTag(`demand:${demandId}`);
  // 清除員工視角快取（workerId 的可配對需求清單可能改變）
  dispatchCache.invalidateByTag(`worker:${workerId}`);
}

/** 定期清除過期 entry（每 5 分鐘執行一次） */
setInterval(() => {
  const purged = dispatchCache.purgeExpired();
  if (purged > 0) {
    console.log(`[Cache] Purged ${purged} expired entries, current size: ${dispatchCache.size}`);
  }
}, 5 * 60 * 1000);
