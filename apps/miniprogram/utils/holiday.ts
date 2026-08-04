import type { HolidayMap, HolidayType } from "../typings/api";

export const HOLIDAY_MIN_YEAR = 2019;
export const HOLIDAY_CACHE_KEY = "wc_holidays";

export function parseHolidayYear(year: number, payload: any): HolidayMap {
  const days: HolidayMap = {};
  const map = payload?.holiday ?? {};
  for (const key of Object.keys(map)) {
    const item = map[key];
    if (!item || typeof item.holiday !== "boolean") continue;
    const date =
      item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : `${year}-${key}`;
    days[date] = item.holiday ? "holiday" : "workday";
  }
  return days;
}

export function mergeHolidayMaps(...maps: Array<HolidayMap | undefined>): HolidayMap {
  const out: HolidayMap = {};
  for (const map of maps) {
    if (!map) continue;
    for (const [date, type] of Object.entries(map)) {
      out[date] = type;
    }
  }
  return out;
}

export function readHolidayCache(): HolidayMap {
  return (wx.getStorageSync(HOLIDAY_CACHE_KEY) as HolidayMap) || {};
}

export function writeHolidayCache(map: HolidayMap): void {
  wx.setStorageSync(HOLIDAY_CACHE_KEY, map);
}

export function isHoliday(map: HolidayMap, date: string): boolean {
  return map[date] === "holiday";
}

export function isOvertime(map: HolidayMap, date: string, kind: string): boolean {
  return kind !== "rest" && map[date] === "holiday";
}

export function yearsInRange(from: string, to: string): number[] {
  const fromYear = Number(from.slice(0, 4));
  const toYear = Number(to.slice(0, 4));
  const years: number[] = [];
  for (let y = Math.max(HOLIDAY_MIN_YEAR, fromYear); y <= toYear; y += 1) {
    years.push(y);
  }
  return years;
}

export function sliceHolidayMap(map: HolidayMap, from: string, to: string): HolidayMap {
  const out: HolidayMap = {};
  for (const [date, type] of Object.entries(map)) {
    if (date >= from && date <= to) out[date] = type;
  }
  return out;
}

export function holidayTypeToText(type: HolidayType | undefined): string {
  if (type === "holiday") return "节假日";
  if (type === "workday") return "调休补班";
  return "";
}
