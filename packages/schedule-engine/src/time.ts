import type { ShiftSnapshot } from "@workcal/shared-types";

const DAY_MINUTES = 24 * 60;

export interface TimeInput {
  startTime: string | null;
  endTime: string | null;
  endsNextDay: boolean;
}

/** "HH:mm" -> 当日分钟数（0-1439） */
export function toMinutes(time: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) {
    throw new Error(`非法时间格式: ${time}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function toTimeString(minutes: number): string {
  const safe = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * 结束时间小于或等于开始时间时，默认视为次日结束（业务规则）。
 * 返回分钟数（0-1440）。跨午夜：21:00 -> 07:00 = 600 分钟。
 */
export function rawDurationMinutes(input: TimeInput): number {
  if (!input.startTime || !input.endTime) return 0;
  const start = toMinutes(input.startTime);
  const end = toMinutes(input.endTime);
  const endsNextDay = input.endsNextDay || end <= start;
  if (endsNextDay) {
    return end <= start ? end - start + DAY_MINUTES : end - start;
  }
  return end - start;
}

/** 工作时长 = 结束-开始-无薪休息；结果不能小于零。 */
export function workDurationMinutes(input: TimeInput, unpaidBreakMinutes: number): number {
  return Math.max(0, rawDurationMinutes(input) - (unpaidBreakMinutes || 0));
}

export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} 分钟`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分`;
}

/** 展示时间区间；跨午夜明确写“次日”。 */
export function formatTimeRange(input: TimeInput): string | null {
  if (!input.startTime || !input.endTime) return null;
  const endsNextDay = input.endsNextDay || toMinutes(input.endTime) <= toMinutes(input.startTime);
  return endsNextDay ? `${input.startTime}–次日${input.endTime}` : `${input.startTime}–${input.endTime}`;
}

export function formatTimeRangeFromSnapshot(snapshot: ShiftSnapshot): string | null {
  if (snapshot.kind === "rest") return null;
  return formatTimeRange({
    startTime: snapshot.startTime,
    endTime: snapshot.endTime,
    endsNextDay: snapshot.endsNextDay,
  });
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateString(d);
}

export function parseDate(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error(`非法日期: ${date}`);
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayInTimezone(timezone: string): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * 把业务日期 + "HH:mm" 转换为带时区的 ISO 时间。
 * 使用 Intl 计算该日期所在时区的 UTC 偏移；默认 Asia/Shanghai。
 */
export function zonedTimeToIso(businessDate: string, time: string, timezone: string): string {
  const offsetMinutes = timezoneOffsetMinutes(businessDate, timezone);
  const date = parseDate(businessDate);
  const minutes = toMinutes(time);
  const utc = new Date(date.getTime() + (minutes - offsetMinutes) * 60_000);
  return utc.toISOString();
}

export function timezoneOffsetMinutes(date: string, timezone: string): number {
  try {
    const probe = new Date(`${date}T12:00:00Z`);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(probe);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    const local = new Date(
      Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second")),
    );
    return (local.getTime() - probe.getTime()) / 60_000;
  } catch {
    return 480; // Asia/Shanghai
  }
}

export function isRestKind(kind: string): boolean {
  return kind === "rest" || kind === "leave" || kind === "training" || kind === "travel";
}
