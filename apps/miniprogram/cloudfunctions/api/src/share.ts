import { db, requireWorkspace, writeAudit } from "./db";
import { toShareSnapshot } from "./map";
import { assert, assertDate, CloudError, nowIso } from "./util";
import { forecastRange, resolveLocation } from "./weather";
import { formatTimeRangeFromSnapshot } from "@workcal/schedule-engine";
import { readHolidayRange } from "./holiday";
import { mergedRuleInstances } from "./schedule";

export async function create(openid: string, payload: any) {
  await requireWorkspace(openid, payload.workspaceId);
  assert(payload.rangeStart && payload.rangeEnd, "VALIDATION_ERROR", "rangeStart 与 rangeEnd 为必填");
  assertDate(payload.rangeStart);
  assertDate(payload.rangeEnd);
  if (payload.rangeStart > payload.rangeEnd) {
    throw new CloudError("VALIDATION_ERROR", "rangeStart 不能晚于 rangeEnd");
  }
  const privacy = {
    showDisplayName: Boolean(payload.privacyOptions?.showDisplayName),
    showTime: Boolean(payload.privacyOptions?.showTime),
    showWeather: Boolean(payload.privacyOptions?.showWeather),
    showLocation: Boolean(payload.privacyOptions?.showLocation),
    showNote: Boolean(payload.privacyOptions?.showNote),
  };
  const userRes = await db.collection("users").doc(openid).get();
  const location = await resolveLocation(openid);
  const weathers = await forecastRange(location, payload.rangeStart, payload.rangeEnd);
  const weatherByDate = new Map(weathers.map((w) => [w.date, w]));
  const instances = await mergedRuleInstances(
    openid,
    payload.workspaceId,
    payload.rangeStart,
    payload.rangeEnd,
  );
  const holidayMap = await readHolidayRange(payload.rangeStart, payload.rangeEnd);
  const entries = instances.map((row: any) => {
    const forecast = weatherByDate.get(row.businessDate);
    return {
      date: row.businessDate,
      shiftName: row.shiftSnapshot?.name,
      shortName: row.shiftSnapshot?.shortName,
      kind: row.shiftSnapshot?.kind,
      color: row.shiftSnapshot?.color,
      timeText: privacy.showTime ? formatTimeRangeFromSnapshot(row.shiftSnapshot) : null,
      location: privacy.showLocation ? (row.locationSnapshot?.name ?? null) : null,
      note: privacy.showNote ? (row.note ?? null) : null,
      weather:
        privacy.showWeather && forecast
          ? {
              conditionText: forecast.conditionText,
              conditionCode: forecast.conditionCode,
              temperatureMin: forecast.temperatureMin,
              temperatureMax: forecast.temperatureMax,
            }
          : null,
      overtime:
        row.kind !== "rest" && holidayMap[row.businessDate] === "holiday" ? true : undefined,
    };
  });
  const createdAt = nowIso();
  const added = await db.collection("shareSnapshots").add({
    data: {
      workspaceId: payload.workspaceId,
      ownerOpenid: openid,
      rangeStart: payload.rangeStart,
      rangeEnd: payload.rangeEnd,
      privacyOptions: privacy,
      templateCode: payload.templateCode || "default",
      snapshot: {
        ownerDisplayName: privacy.showDisplayName ? userRes.data?.displayName ?? null : null,
        rangeStart: payload.rangeStart,
        rangeEnd: payload.rangeEnd,
        templateCode: payload.templateCode || "default",
        privacyOptions: privacy,
        entries,
      },
      createdAt,
    },
  });
  const doc = await db.collection("shareSnapshots").doc(added._id as string).get();
  await writeAudit(openid, payload.workspaceId, "share.create", "shareSnapshot", added._id as string, {
    rangeStart: payload.rangeStart,
    rangeEnd: payload.rangeEnd,
    entries: entries.length,
  });
  return toShareSnapshot(doc.data);
}
