import { db, requireWorkspace } from "./db";
import { CloudError } from "./util";

type HolidayMap = Record<string, "holiday" | "workday">;

export const HOLIDAY_MIN_YEAR = 2019;
const API_BASE = "https://timor.tech/api/holiday/year/";

export async function syncYear(year: number): Promise<{ year: number; count: number }> {
  const res = await fetch(`${API_BASE}${year}`);
  if (!res.ok) {
    throw new CloudError("HOLIDAY_FETCH_FAILED", `节假日接口返回 ${res.status}`, 502);
  }
  const data: any = await res.json();
  const days: HolidayMap = {};
  const map = data?.holiday ?? {};
  for (const key of Object.keys(map)) {
    const item = map[key];
    if (!item || typeof item.holiday !== "boolean") continue;
    const date =
      item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : `${year}-${key}`;
    days[date] = item.holiday ? "holiday" : "workday";
  }
  await db.collection("holidays").doc(`year:${year}`).set({
    data: {
      year,
      days,
      source: "timor.tech",
      updatedAt: new Date().toISOString(),
    },
  });
  return { year, count: Object.keys(days).length };
}

export async function syncRange(fromYear: number, toYear: number) {
  const results: Array<{ year: number; count: number }> = [];
  for (let year = fromYear; year <= toYear; year += 1) {
    try {
      results.push(await syncYear(year));
    } catch (err) {
      console.warn(`[holiday] ${year} 同步失败:`, (err as Error).message);
    }
  }
  return results;
}

export async function readHolidayRange(from: string, to: string): Promise<HolidayMap> {
  const fromYear = Number(from.slice(0, 4));
  const toYear = Number(to.slice(0, 4));
  const out: HolidayMap = {};
  for (let year = fromYear; year <= toYear; year += 1) {
    try {
      const doc = await db.collection("holidays").doc(`year:${year}`).get();
      const days = doc.data?.days;
      if (days) {
        for (const [date, type] of Object.entries(days)) {
          if (date >= from && date <= to) {
            out[date] = type as HolidayMap[string];
          }
        }
      }
    } catch {
      // 未同步的年份跳过
    }
  }
  return out;
}

export async function ensureYears(fromYear: number, toYear: number): Promise<void> {
  for (let year = fromYear; year <= toYear; year += 1) {
    try {
      await db.collection("holidays").doc(`year:${year}`).get();
    } catch {
      try {
        await syncYear(year);
      } catch (err) {
        console.warn(`[holiday] ${year} 懒加载失败:`, (err as Error).message);
      }
    }
  }
}

export async function getRange(
  openid: string,
  payload: { workspaceId: string; from: string; to: string },
): Promise<HolidayMap> {
  await requireWorkspace(openid, payload.workspaceId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.from) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.to)) {
    throw new CloudError("VALIDATION_ERROR", "日期格式必须为 YYYY-MM-DD");
  }
  if (payload.from > payload.to) {
    throw new CloudError("VALIDATION_ERROR", "from 不能晚于 to");
  }
  const fromYear = Math.max(HOLIDAY_MIN_YEAR, Number(payload.from.slice(0, 4)));
  const toYear = Number(payload.to.slice(0, 4));
  await ensureYears(fromYear, toYear);
  return readHolidayRange(payload.from, payload.to);
}

export async function sync(
  openid: string,
  payload: { workspaceId: string },
): Promise<{ synced: Array<{ year: number; count: number }> }> {
  await requireWorkspace(openid, payload.workspaceId);
  const currentYear = new Date().getFullYear();
  const fromYear = Math.max(HOLIDAY_MIN_YEAR, currentYear - 1);
  const synced = await syncRange(fromYear, currentYear + 1);
  return { synced };
}
