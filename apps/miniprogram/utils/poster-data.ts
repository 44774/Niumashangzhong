import type {
  SharePrivacyOptions,
  ScheduleInstance,
  ShareSnapshotEntry,
  WeatherForecast,
} from "../typings/api";
import { formatTimeRange } from "./format";

/** 本地预览使用的隐私过滤逻辑，与服务端保持一致。 */
export function buildPreviewEntries(
  instances: ScheduleInstance[],
  weatherList: WeatherForecast[],
  privacy: SharePrivacyOptions,
): ShareSnapshotEntry[] {
  const weatherByDate = new Map(weatherList.map((w) => [w.date, w]));
  return instances.map((row) => {
    const forecast = weatherByDate.get(row.businessDate);
    return {
      date: row.businessDate,
      shiftName: row.shiftSnapshot.name,
      shortName: row.shiftSnapshot.shortName,
      kind: row.shiftSnapshot.kind,
      color: row.shiftSnapshot.color,
      timeText: privacy.showTime ? formatTimeRange(row.shiftSnapshot) : null,
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
    };
  });
}
