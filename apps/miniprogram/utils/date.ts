const WEEKDAY_CN = ["日", "一", "二", "三", "四", "五", "六"];

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function todayString(): string {
  // 默认 Asia/Shanghai（+08:00，无夏令时）
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function parseDate(date: string): { year: number; month: number; day: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { year: y ?? 0, month: m ?? 1, day: d ?? 1 };
}

export function monthLabel(year: number, month: number): string {
  return `${year}年${month}月`;
}

export function formatDateCN(date: string): string {
  const { year, month, day } = parseDate(date);
  return `${year}年${month}月${day}日`;
}

export function weekdayCN(date: string): string {
  const { year, month, day } = parseDate(date);
  const wd = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `周${WEEKDAY_CN[wd] ?? ""}`;
}

export function formatDateShort(date: string): string {
  const { month, day } = parseDate(date);
  return `${month}月${day}日`;
}

export function rangeDays(from: string, to: string): string[] {
  const result: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    result.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return result;
}

export interface MonthCell {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

/** 生成 6x7 月历网格，周一为一周起始。 */
export function buildMonthGrid(year: number, month: number, today: string): MonthCell[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstDay = first.getUTCDay();
  const offset = (firstDay + 6) % 7; // 周一=0
  const start = new Date(Date.UTC(year, month - 1, 1 - offset));
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const dt = new Date(start.getTime() + i * 86_400_000);
    const date = `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
    cells.push({
      date,
      day: dt.getUTCDate(),
      inMonth: dt.getUTCMonth() + 1 === month,
      isToday: date === today,
    });
  }
  return cells;
}

export function weekRange(from: string): string[] {
  return rangeDays(from, addDays(from, 6));
}

export function thisWeekRange(): { start: string; end: string } {
  const today = todayString();
  return { start: today, end: addDays(today, 6) };
}

export function thisMonthRange(): { start: string; end: string } {
  const today = todayString();
  const { year, month } = parseDate(today);
  const start = `${year}-${pad2(month)}-01`;
  const end = addDays(`${year}-${pad2(month + 1)}-01`, -1);
  return { start, end };
}
