import { api } from "./api";
import {
  mergeHolidayMaps,
  readHolidayCache,
  sliceHolidayMap,
  writeHolidayCache,
  yearsInRange,
} from "../utils/holiday";

/** 确保本地节假日缓存覆盖 [from,to]，返回该范围映射；接口失败时返回已有缓存。 */
export async function ensureHolidayRange(from: string, to: string): Promise<Record<string, "holiday" | "workday">> {
  const cache = readHolidayCache();
  const needed = yearsInRange(from, to);
  const missingYears = needed.filter((year) => {
    const prefix = `${year}-`;
    return !Object.keys(cache).some((date) => date.startsWith(prefix));
  });
  if (missingYears.length > 0) {
    try {
      const fetched = await api.holidayRange(from, to);
      writeHolidayCache(mergeHolidayMaps(cache, fetched));
    } catch {
      // 失败时使用已有缓存
    }
  }
  return sliceHolidayMap(readHolidayCache(), from, to);
}
