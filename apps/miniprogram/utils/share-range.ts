/** 超过该天数视为“长海报”，生成前需要用户确认 */
export const LONG_RANGE_DAYS = 92;

export function rangeDaysCount(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const s = Date.UTC(sy ?? 0, (sm ?? 1) - 1, sd ?? 1);
  const e = Date.UTC(ey ?? 0, (em ?? 1) - 1, ed ?? 1);
  return Math.round((e - s) / 86_400_000) + 1;
}

export function needsLongRangeWarning(start: string, end: string): boolean {
  return rangeDaysCount(start, end) > LONG_RANGE_DAYS;
}

export function isMultiDay(start: string, end: string): boolean {
  return start !== end;
}
