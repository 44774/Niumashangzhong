import type { CustomShift, ShiftSnapshot } from "@workcal/shared-types";
import { toMinutes, zonedTimeToIso, addDays } from "@workcal/schedule-engine";
import { validationError } from "./errors.js";

export function normalizeSnapshot(input: CustomShift): ShiftSnapshot {
  const kind = input.kind ?? "custom";
  const startTime = input.startTime ?? null;
  const endTime = input.endTime ?? null;
  if (kind === "work" && (!startTime || !endTime)) {
    throw validationError("工作类班次必须填写开始和结束时间");
  }
  if (startTime && endTime) {
    try {
      toMinutes(startTime);
      toMinutes(endTime);
    } catch {
      throw validationError("时间格式必须为 HH:mm");
    }
  }
  const endsNextDay = Boolean(input.endsNextDay) || (!!startTime && !!endTime && toMinutes(endTime) <= toMinutes(startTime));
  return {
    name: input.name?.trim() || "自定义班次",
    shortName: input.name?.trim().slice(0, 4) || "自定义",
    kind,
    color: input.color || "#1F6FEB",
    startTime,
    endTime,
    endsNextDay,
    unpaidBreakMinutes: Math.max(0, input.unpaidBreakMinutes ?? 0),
  };
}

export function instanceTimes(
  businessDate: string,
  snapshot: ShiftSnapshot,
  timezone: string,
): { startsAt: Date | null; endsAt: Date | null } {
  if (snapshot.kind === "rest" || !snapshot.startTime || !snapshot.endTime) {
    return { startsAt: null, endsAt: null };
  }
  const startsAt = new Date(zonedTimeToIso(businessDate, snapshot.startTime, timezone));
  const endDate = snapshot.endsNextDay ? addDays(businessDate, 1) : businessDate;
  const endsAt = new Date(zonedTimeToIso(endDate, snapshot.endTime, timezone));
  return { startsAt, endsAt };
}

export function validateBusinessDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw validationError("日期格式必须为 YYYY-MM-DD");
  }
}
