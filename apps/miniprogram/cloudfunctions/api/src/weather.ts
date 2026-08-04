import { addDays, todayInTimezone } from "@workcal/schedule-engine";
import { db, _, requireWorkspace } from "./db";
import { assertDate, CloudError } from "./util";

interface WeatherLocationInput {
  name: string;
  latitude: number;
  longitude: number;
}

const WMO_MAP: Record<number, { text: string; code: string; warnings: string[] }> = {
  0: { text: "晴", code: "sunny", warnings: [] },
  1: { text: "晴间多云", code: "partly_cloudy", warnings: [] },
  2: { text: "多云", code: "cloudy", warnings: [] },
  3: { text: "阴", code: "overcast", warnings: [] },
  45: { text: "雾", code: "fog", warnings: [] },
  48: { text: "雾凇", code: "fog", warnings: [] },
  51: { text: "毛毛雨", code: "drizzle", warnings: [] },
  53: { text: "毛毛雨", code: "drizzle", warnings: [] },
  55: { text: "毛毛雨", code: "drizzle", warnings: [] },
  56: { text: "冻毛毛雨", code: "freezing_drizzle", warnings: ["ice"] },
  57: { text: "冻毛毛雨", code: "freezing_drizzle", warnings: ["ice"] },
  61: { text: "小雨", code: "rain", warnings: [] },
  63: { text: "中雨", code: "rain", warnings: [] },
  65: { text: "大雨", code: "rain", warnings: [] },
  66: { text: "冻雨", code: "freezing_rain", warnings: ["ice"] },
  67: { text: "冻雨", code: "freezing_rain", warnings: ["ice"] },
  71: { text: "小雪", code: "snow", warnings: [] },
  73: { text: "中雪", code: "snow", warnings: [] },
  75: { text: "大雪", code: "snow", warnings: [] },
  77: { text: "雪粒", code: "snow", warnings: [] },
  80: { text: "阵雨", code: "shower", warnings: [] },
  81: { text: "阵雨", code: "shower", warnings: [] },
  82: { text: "强阵雨", code: "shower", warnings: [] },
  85: { text: "阵雪", code: "snow", warnings: [] },
  86: { text: "阵雪", code: "snow", warnings: [] },
  95: { text: "雷阵雨", code: "thunderstorm", warnings: ["storm"] },
  96: { text: "雷阵雨伴冰雹", code: "thunderstorm", warnings: ["storm", "hail"] },
  99: { text: "雷阵雨伴冰雹", code: "thunderstorm", warnings: ["storm", "hail"] },
};

export function mapWeatherCode(code: number): { text: string; code: string; warnings: string[] } {
  return WMO_MAP[code] ?? { text: "未知天气", code: "unknown", warnings: [] };
}

function locationKey(location: WeatherLocationInput): string {
  return `loc:${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
}

async function openMeteo(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo 返回 ${res.status}`);
  }
  return res.json();
}

function toForecast(
  location: WeatherLocationInput,
  date: string,
  daily: any,
  index: number,
): any {
  const code = daily.weather_code?.[index] ?? 0;
  const mapped = mapWeatherCode(Number(code));
  const max = daily.temperature_2m_max?.[index];
  const min = daily.temperature_2m_min?.[index];
  const warnings = [...mapped.warnings];
  if (max != null && Number(max) >= 35) warnings.push("heat");
  if (min != null && Number(min) <= 0) warnings.push("cold");
  return {
    date,
    conditionCode: mapped.code,
    conditionText: mapped.text,
    temperatureMin: min != null ? Number(min) : 0,
    temperatureMax: max != null ? Number(max) : 0,
    humidityPercent: null,
    precipitationProbability: daily.precipitation_probability_max?.[index] ?? null,
    windDirection: null,
    windLevel: daily.wind_speed_10m_max?.[index] != null ? `${daily.wind_speed_10m_max[index]}km/h` : null,
    airQuality: null,
    warningCodes: warnings,
    updatedAt: new Date().toISOString(),
  };
}

function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

/** Open-Meteo：今天前 92 天到未来 16 天用 forecast；更早用 archive。 */
export async function forecastRange(
  location: WeatherLocationInput,
  from: string,
  to: string,
): Promise<any[]> {
  const today = todayInTimezone("Asia/Shanghai");
  const pastLimit = addDays(today, -92);
  const futureLimit = addDays(today, 16);
  const archiveStart = from < pastLimit ? from : null;
  const archiveEnd = archiveStart ? minDate(to, addDays(pastLimit, -1)) : null;
  const forecastStart = maxDate(from, pastLimit);
  const forecastEnd = minDate(to, futureLimit);
  const baseParams =
    "daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=Asia%2FShanghai";

  const jobs: Array<Promise<{ date: string; item: any }[]>> = [];
  if (archiveStart && archiveEnd && archiveStart <= archiveEnd) {
    const url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${location.latitude}` +
      `&longitude=${location.longitude}&start_date=${archiveStart}&end_date=${archiveEnd}&${baseParams}`;
    jobs.push(
      openMeteo(url).then((data) => {
        const daily = data.daily ?? {};
        return (daily.time ?? []).map((date: string, i: number) => ({
          date,
          item: toForecast(location, date, daily, i),
        }));
      }),
    );
  }
  if (forecastStart <= forecastEnd) {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}` +
      `&longitude=${location.longitude}&start_date=${forecastStart}&end_date=${forecastEnd}&${baseParams}`;
    jobs.push(
      openMeteo(url).then((data) => {
        const daily = data.daily ?? {};
        return (daily.time ?? []).map((date: string, i: number) => ({
          date,
          item: toForecast(location, date, daily, i),
        }));
      }),
    );
  }
  const settled = await Promise.allSettled(jobs);
  const rows: Array<{ date: string; item: any }> = [];
  for (const s of settled) {
    if (s.status === "fulfilled") rows.push(...s.value);
  }
  const byDate = new Map(rows.map((r) => [r.date, r.item]));
  const key = locationKey(location);
  const result: any[] = [];
  let cursor = from;
  while (cursor <= to) {
    const item = byDate.get(cursor);
    if (item) {
      await db
        .collection("weatherCache")
        .doc(`${key}_${cursor}`)
        .set({
          data: {
            locationKey: key,
            date: cursor,
            timezone: "Asia/Shanghai",
            ...item,
            expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          },
        });
      result.push(item);
    }
    cursor = addDays(cursor, 1);
  }
  return result;
}

export async function resolveLocation(
  openid: string,
  location?: WeatherLocationInput,
): Promise<WeatherLocationInput> {
  if (location && typeof location.latitude === "number" && typeof location.longitude === "number") {
    return location;
  }
  try {
    const userRes = await db.collection("users").doc(openid).get();
    const def = userRes.data?.defaultLocation;
    if (def && typeof def.latitude === "number" && typeof def.longitude === "number") {
      return def;
    }
  } catch {
    // 回退默认城市
  }
  return { name: "深圳", latitude: 22.5431, longitude: 114.0579 };
}

export async function get(
  openid: string,
  payload: { workspaceId: string; from: string; to: string; location?: WeatherLocationInput },
) {
  await requireWorkspace(openid, payload.workspaceId);
  assertDate(payload.from);
  assertDate(payload.to);
  if (payload.from > payload.to) {
    throw new CloudError("VALIDATION_ERROR", "from 不能晚于 to");
  }
  const location = await resolveLocation(openid, payload.location);
  try {
    return await forecastRange(location, payload.from, payload.to);
  } catch (err) {
    console.warn("[weather] Open-Meteo 获取失败，回退缓存", (err as Error).message);
    const key = locationKey(location);
    const cached = await db
      .collection("weatherCache")
      .where({ locationKey: key, date: _.gte(payload.from).and(_.lte(payload.to)) })
      .limit(100)
      .get();
    return cached.data
      .filter((row: any) => new Date(row.expiresAt).getTime() > Date.now())
      .map((row: any) => {
        const copy = { ...row };
        delete copy.locationKey;
        delete copy.expiresAt;
        return copy;
      });
  }
}

export async function getForDate(
  openid: string,
  date: string,
): Promise<any | null> {
  const location = await resolveLocation(openid);
  const list = await forecastRange(location, date, date);
  return list[0] ?? null;
}
