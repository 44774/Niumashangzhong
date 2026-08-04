import { and, eq, gte, lte } from "drizzle-orm";
import type { WeatherForecast } from "@workcal/shared-types";
import type { Db } from "../db/client.js";
import { weatherForecasts } from "../db/schema.js";
import { addDays } from "@workcal/schedule-engine";

export interface WeatherProvider {
  name: string;
  forecastRange(
    city: string,
    from: string,
    to: string,
    timezone: string,
  ): Promise<WeatherForecast[]>;
}

const CONDITIONS: Array<{ code: string; text: string; rain: number }> = [
  { code: "sunny", text: "晴", rain: 0 },
  { code: "cloudy", text: "多云", rain: 10 },
  { code: "overcast", text: "阴", rain: 30 },
  { code: "rain", text: "小雨", rain: 60 },
  { code: "thunderstorm", text: "雷阵雨", rain: 90 },
  { code: "windy", text: "大风", rain: 20 },
];

export class MockWeatherProvider implements WeatherProvider {
  name = "mock";

  async forecastRange(
    _city: string,
    from: string,
    to: string,
    _timezone: string,
  ): Promise<WeatherForecast[]> {
    const result: WeatherForecast[] = [];
    let cursor = from;
    let index = 0;
    while (cursor <= to && index < 31) {
      const cond = CONDITIONS[index % CONDITIONS.length];
      if (!cond) break;
      const base = index % 5;
      const warningCodes = cond.code === "thunderstorm" ? ["storm"] : [];
      result.push({
        date: cursor,
        conditionCode: cond.code,
        conditionText: cond.text,
        temperatureMin: 24 + base,
        temperatureMax: 29 + base,
        humidityPercent: 55 + (index * 7) % 30,
        precipitationProbability: cond.rain + (index % 3) * 5,
        windDirection: ["东风", "南风", "西风", "北风"][index % 4] ?? null,
        windLevel: `${1 + (index % 4)}级`,
        airQuality: ["优", "良", "轻度污染"][index % 3] ?? null,
        warningCodes,
        updatedAt: new Date().toISOString(),
      });
      cursor = addDays(cursor, 1);
      index += 1;
    }
    return result;
  }
}

export class BrokenWeatherProvider implements WeatherProvider {
  name = "broken";

  async forecastRange(): Promise<WeatherForecast[]> {
    throw new Error("weather provider unavailable");
  }
}

export class WeatherService {
  constructor(
    private readonly db: Db,
    private readonly provider: WeatherProvider,
  ) {}

  /**
   * 天气永远不阻塞排班：Provider 失败时回退缓存，无缓存则返回空数组。
   */
  async getRange(
    city: string,
    from: string,
    to: string,
    timezone: string,
  ): Promise<WeatherForecast[]> {
    const locationKey = `city:${city}`;
    try {
      const fresh = await this.provider.forecastRange(city, from, to, timezone);
      for (const item of fresh) {
        await this.db
          .insert(weatherForecasts)
          .values({
            provider: this.provider.name,
            locationKey,
            forecastDate: item.date,
            timezone,
            conditionCode: item.conditionCode,
            conditionText: item.conditionText,
            temperatureMin: String(item.temperatureMin),
            temperatureMax: String(item.temperatureMax),
            humidityPercent: item.humidityPercent,
            precipitationProbability: item.precipitationProbability,
            windDirection: item.windDirection,
            windLevel: item.windLevel,
            airQuality: item.airQuality,
            warningCodes: item.warningCodes,
            generatedAt: new Date(),
            expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
          })
          .onConflictDoUpdate({
            target: [
              weatherForecasts.provider,
              weatherForecasts.locationKey,
              weatherForecasts.forecastDate,
              weatherForecasts.timezone,
            ],
            set: {
              conditionCode: item.conditionCode,
              conditionText: item.conditionText,
              temperatureMin: String(item.temperatureMin),
              temperatureMax: String(item.temperatureMax),
              humidityPercent: item.humidityPercent,
              precipitationProbability: item.precipitationProbability,
              windDirection: item.windDirection,
              windLevel: item.windLevel,
              airQuality: item.airQuality,
              warningCodes: item.warningCodes,
              generatedAt: new Date(),
              expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
            },
          });
      }
      return fresh;
    } catch (err) {
      // 回退缓存
      const cached = await this.db
        .select()
        .from(weatherForecasts)
        .where(
          and(
            eq(weatherForecasts.provider, this.provider.name),
            eq(weatherForecasts.locationKey, locationKey),
            eq(weatherForecasts.timezone, timezone),
            gte(weatherForecasts.forecastDate, from),
            lte(weatherForecasts.forecastDate, to),
            gte(weatherForecasts.expiresAt, new Date()),
          ),
        )
        .orderBy(weatherForecasts.forecastDate);
      if (cached.length > 0) {
        return cached.map(toForecast);
      }
      console.warn(`[weather] ${this.provider.name} 获取失败，返回空数据:`, (err as Error).message);
      return [];
    }
  }
}

export function toForecast(row: typeof weatherForecasts.$inferSelect): WeatherForecast {
  return {
    date: row.forecastDate,
    conditionCode: row.conditionCode ?? "unknown",
    conditionText: row.conditionText ?? "暂无天气数据",
    temperatureMin: row.temperatureMin ? Number(row.temperatureMin) : 0,
    temperatureMax: row.temperatureMax ? Number(row.temperatureMax) : 0,
    humidityPercent: row.humidityPercent,
    precipitationProbability: row.precipitationProbability,
    windDirection: row.windDirection,
    windLevel: row.windLevel,
    airQuality: row.airQuality,
    warningCodes: row.warningCodes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createWeatherProvider(kind: string): WeatherProvider {
  if (kind === "broken") return new BrokenWeatherProvider();
  return new MockWeatherProvider();
}
