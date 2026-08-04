const memory = new Map<string, { expiresAt: number; value: unknown }>();

interface StoredEntry<T> {
  expiresAt: number;
  value: T;
}

/** 通用缓存：先内存、再 storage，未命中才执行 loader。 */
export async function cachedLoad<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const mem = memory.get(key);
  if (mem && mem.expiresAt > now) {
    return mem.value as T;
  }
  try {
    const stored = wx.getStorageSync(key) as StoredEntry<T> | "";
    if (stored && typeof stored === "object" && stored.expiresAt > now) {
      memory.set(key, { expiresAt: stored.expiresAt, value: stored.value });
      return stored.value;
    }
  } catch {
    // storage 读取失败则忽略
  }
  const value = await loader();
  const expiresAt = now + ttlMs;
  memory.set(key, { expiresAt, value });
  try {
    wx.setStorageSync(key, { expiresAt, value } satisfies StoredEntry<T>);
  } catch {
    // 存储满等异常忽略
  }
  return value;
}

export function invalidateCache(key: string): void {
  memory.delete(key);
  try {
    wx.removeStorageSync(key);
  } catch {
    // 忽略
  }
}
