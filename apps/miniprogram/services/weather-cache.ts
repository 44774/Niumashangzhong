import { api } from "./api";
import type { WeatherForecast, WeatherLocation } from "../typings/api";
import { getDefaultLocation, normalizeLocation } from "../stores/location";

const KEY = "wc_weather_cache";
const TTL = 6 * 60 * 60 * 1000;

interface WeatherCacheEntry {
  date: string;
  data: WeatherForecast;
  expiresAt: number;
  cacheKey?: string;
}

function read(): WeatherCacheEntry[] {
  return (wx.getStorageSync(KEY) as WeatherCacheEntry[]) || [];
}

function write(entries: WeatherCacheEntry[]): void {
  wx.setStorageSync(KEY, entries);
}

function addDaysLocal(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** 客户端 6 小时天气缓存：命中直接返回，未命中才请求（云模式经云函数/本地直连）。 */
export async function getWeatherCached(
  from: string,
  to: string,
  location?: WeatherLocation | string,
): Promise<WeatherForecast[]> {
  const loc =
    normalizeLocation(location) ??
    getDefaultLocation() ?? { name: "深圳", latitude: 22.5431, longitude: 114.0579 };
  const key = `loc:${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`;
  const now = Date.now();
  const cache = read();
  const result: WeatherForecast[] = [];
  let missing = 0;
  let cursor = from;
  while (cursor <= to) {
    const entry = cache.find((c) => c.date === cursor && c.cacheKey === key && c.expiresAt > now);
    if (entry) {
      result.push(entry.data);
    } else {
      missing += 1;
    }
    cursor = addDaysLocal(cursor, 1);
  }
  if (missing === 0) {
    return result.sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  try {
    const fresh = await api.weather(from, to, loc);
    const kept = cache.filter((c) => c.expiresAt > now);
    const next = [
      ...kept,
      ...fresh.map((data) => ({ date: data.date, data, expiresAt: now + TTL, cacheKey: key })),
    ];
    write(next);
    return fresh.sort((a, b) => (a.date < b.date ? -1 : 1));
  } catch {
    return result.sort((a, b) => (a.date < b.date ? -1 : 1));
  }
}
