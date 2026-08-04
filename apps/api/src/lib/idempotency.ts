import { eq } from "drizzle-orm";
import type { Db, Tx } from "../db/client.js";
import { idempotencyEntries } from "../db/schema.js";

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

/**
 * 通用幂等封装：带 Idempotency-Key 的写操作只执行一次，
 * 重复请求返回首次响应；scope 用于区分不同接口。
 */
export async function withIdempotency<T>(
  db: Db,
  scope: string,
  key: string | undefined,
  handler: (tx: Db | Tx) => Promise<T>,
): Promise<T> {
  if (!key) {
    return handler(db);
  }
  const existing = await db
    .select()
    .from(idempotencyEntries)
    .where(eq(idempotencyEntries.idempotencyKey, key))
    .limit(1);
  if (existing.length > 0) {
    const row = existing[0];
    if (row) return row.response as T;
  }

  let result: T | undefined;
  try {
    await db.transaction(async (tx) => {
      result = await handler(tx);
      await tx.insert(idempotencyEntries).values({
        idempotencyKey: key,
        scope,
        response: result as unknown as Record<string, unknown>,
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const row = await db
        .select()
        .from(idempotencyEntries)
        .where(eq(idempotencyEntries.idempotencyKey, key))
        .limit(1);
      if (row.length > 0) {
        const hit = row[0];
        if (hit) return hit.response as T;
      }
    }
    throw err;
  }
  if (result === undefined) {
    throw new Error("幂等事务未返回结果");
  }
  return result;
}
