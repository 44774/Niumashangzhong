import type { CustomShift, ShiftSnapshot } from "../typings/api";

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** 业务日期 + HH:mm → ISO 字符串（默认 Asia/Shanghai +08:00，无夏令时） */
export function zonedTimeToIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, (hh ?? 0) - 8, mm ?? 0)).toISOString();
}

export function normalizeSnapshot(input: CustomShift): ShiftSnapshot {
  const kind = input.kind ?? "custom";
  const startTime = input.startTime ?? null;
  const endTime = input.endTime ?? null;
  if (kind === "work" && (!startTime || !endTime)) {
    throw new Error("工作类班次必须填写开始和结束时间");
  }
  const endsNextDay =
    Boolean(input.endsNextDay) || (!!startTime && !!endTime && toMinutes(endTime) <= toMinutes(startTime));
  const name = input.name?.trim() || "自定义班次";
  return {
    name,
    shortName: name.slice(0, 4) || "自定义",
    kind,
    color: input.color || "#1F6FEB",
    startTime,
    endTime,
    endsNextDay,
    unpaidBreakMinutes: Math.max(0, input.unpaidBreakMinutes ?? 0),
  };
}

export function instanceTimes(date: string, snap: ShiftSnapshot): { startsAt: string | null; endsAt: string | null } {
  if (snap.kind === "rest" || !snap.startTime || !snap.endTime) {
    return { startsAt: null, endsAt: null };
  }
  const startsAt = zonedTimeToIso(date, snap.startTime);
  const endDate = snap.endsNextDay ? addDaysLocal(date, 1) : date;
  const endsAt = zonedTimeToIso(endDate, snap.endTime);
  return { startsAt, endsAt };
}

export function intervalsOverlap(
  a: { startsAt: string | null; endsAt: string | null; kind: string },
  b: { startsAt: string | null; endsAt: string | null; kind: string },
): boolean {
  if (!a.startsAt || !a.endsAt || !b.startsAt || !b.endsAt) return false;
  if (a.kind === "rest" || b.kind === "rest") return false;
  return new Date(a.startsAt).getTime() < new Date(b.endsAt).getTime() &&
    new Date(b.startsAt).getTime() < new Date(a.endsAt).getTime();
}

export function cycleSlots(
  startDate: string,
  sequence: string[],
  days: number,
): Array<{ date: string; shiftTemplateId: string }> {
  if (sequence.length === 0) throw new Error("班次序列不能为空");
  const slots: Array<{ date: string; shiftTemplateId: string }> = [];
  for (let i = 0; i < days; i += 1) {
    const date = addDaysLocal(startDate, i);
    const shiftTemplateId = sequence[i % sequence.length];
    if (!shiftTemplateId) throw new Error("班次序列包含空项");
    slots.push({ date, shiftTemplateId });
  }
  return slots;
}

export function addDaysLocal(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate(),
  ).padStart(2, "0")}`;
}
