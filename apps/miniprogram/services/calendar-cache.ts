import type { ScheduleInstance, ShiftTemplate } from "../typings/api";

export interface CalendarWindowData {
  shiftMap: Record<string, Array<{ name: string; shortName: string; color: string; overtime?: boolean }>>;
  legend: ShiftTemplate[];
  todaySummary: ScheduleInstance | null;
  todayLabel: string;
  todayTimeText: string;
  todayLocation: string;
  todayDuration: string;
  changeDates: string[];
}

const memory = new Map<string, { data: CalendarWindowData; expiresAt: number }>();
const TTL = 10 * 60 * 1000;

export function getCalendarWindow(year: number, month: number): CalendarWindowData | null {
  const key = `${year}-${month}`;
  const hit = memory.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.data;
  return null;
}

export function setCalendarWindow(year: number, month: number, data: CalendarWindowData): void {
  memory.set(`${year}-${month}`, { data, expiresAt: Date.now() + TTL });
}

export function clearCalendarCache(): void {
  memory.clear();
}
