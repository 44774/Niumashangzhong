export interface TimeInterval {
  id: string;
  startsAt: string | null;
  endsAt: string | null;
  kind: string;
}

/** 两个时间区间是否重叠（含端点相接）。休息/无时间班次不参与。 */
export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  if (!a.startsAt || !a.endsAt || !b.startsAt || !b.endsAt) return false;
  if (a.kind === "rest" || b.kind === "rest") return false;
  const aStart = new Date(a.startsAt).getTime();
  const aEnd = new Date(a.endsAt).getTime();
  const bStart = new Date(b.startsAt).getTime();
  const bEnd = new Date(b.endsAt).getTime();
  return aStart < bEnd && bStart < aEnd;
}

export function findOverlapConflicts(
  candidate: TimeInterval,
  existing: TimeInterval[],
): Array<{ existingId: string; message: string }> {
  const result: Array<{ existingId: string; message: string }> = [];
  for (const item of existing) {
    if (item.id !== candidate.id && intervalsOverlap(candidate, item)) {
      result.push({
        existingId: item.id,
        message: `该时段与 ${item.id} 重叠`,
      });
    }
  }
  return result;
}
