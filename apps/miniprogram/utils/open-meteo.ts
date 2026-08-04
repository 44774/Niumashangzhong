import type { WeatherForecast, WeatherLocation } from "../typings/api";

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

const CACHE_KEY = "wc_weather_cache";
const CACHE_TTL = 6 * 60 * 60 * 1000;

interface CacheEntry {
  date: string;
  data: WeatherForecast;
  expiresAt: number;
  cacheKey?: string;
}

function readCache(): CacheEntry[] {
  return (wx.getStorageSync(CACHE_KEY) as CacheEntry[]) || [];
}

function writeCache(entries: CacheEntry[]): void {
  wx.setStorageSync(CACHE_KEY, entries);
}

function requestJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: "GET",
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
        } else {
          reject(new Error(`Open-Meteo 返回 ${res.statusCode}`));
        }
      },
      fail: () => reject(new Error("天气服务连接失败")),
    });
  });
}

function toForecast(date: string, daily: any, index: number): WeatherForecast {
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

/** 本地模式直连 Open-Meteo（forecast + archive），失败时回退本地缓存。 */
export async function fetchOpenMeteo(
  location: WeatherLocation,
  from: string,
  to: string,
): Promise<WeatherForecast[]> {
  const cache = readCache();
  const key = `loc:${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
  const baseParams =
    "daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=Asia%2FShanghai";
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const pastLimit = addDaysLocal(today, -92);
  const futureLimit = addDaysLocal(today, 16);
  const archiveStart = from < pastLimit ? from : null;
  const archiveEnd = archiveStart ? minDate(to, addDaysLocal(pastLimit, -1)) : null;
  const forecastStart = maxDate(from, pastLimit);
  const forecastEnd = minDate(to, futureLimit);
  const jobs: Array<Promise<any>> = [];
  if (archiveStart && archiveEnd && archiveStart <= archiveEnd) {
    jobs.push(
      requestJson(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${location.latitude}&longitude=${location.longitude}&start_date=${archiveStart}&end_date=${archiveEnd}&${baseParams}`,
      ),
    );
  }
  if (forecastStart <= forecastEnd) {
    jobs.push(
      requestJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&start_date=${forecastStart}&end_date=${forecastEnd}&${baseParams}`,
      ),
    );
  }
  const settled = await Promise.allSettled(jobs);
  const rows: Array<{ date: string; data: WeatherForecast }> = [];
  for (const s of settled) {
    if (s.status === "fulfilled") {
      const daily = s.value.daily ?? {};
      (daily.time ?? []).forEach((date: string, i: number) => {
        rows.push({ date, data: toForecast(date, daily, i) });
      });
    }
  }
  if (rows.length > 0) {
    const merged = new Map<string, WeatherForecast>();
    for (const row of rows) merged.set(row.date, row.data);
    const now = Date.now();
    const next: CacheEntry[] = [];
    for (const [date, data] of merged.entries()) {
      next.push({
        date,
        data,
        expiresAt: now + CACHE_TTL,
        ...(key ? { cacheKey: key } : {}),
      });
    }
    const kept = cache.filter((c) => c.expiresAt > now);
    writeCache([...kept, ...next]);
  }
  const result: WeatherForecast[] = [];
  let cursor = from;
  while (cursor <= to) {
    const fresh = rows.find((r) => r.date === cursor);
    const cached = cache.find((c) => c.date === cursor && (c as any).cacheKey === key);
    if (fresh) result.push(fresh.data);
    else if (cached) result.push(cached.data);
    cursor = addDaysLocal(cursor, 1);
  }
  return result;
}

function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

function addDaysLocal(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate(),
  ).padStart(2, "0")}`;
}
