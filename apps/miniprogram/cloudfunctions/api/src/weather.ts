import { addDays } from "@workcal/schedule-engine";
import { db, requireWorkspace } from "./db";
import { assert, assertDate, CloudError } from "./util";

const CONDITIONS = [
  { code: "sunny", text: "晴", rain: 0 },
  { code: "cloudy", text: "多云", rain: 10 },
  { code: "overcast", text: "阴", rain: 30 },
  { code: "rain", text: "小雨", rain: 60 },
  { code: "thunderstorm", text: "雷阵雨", rain: 90 },
  { code: "windy", text: "大风", rain: 20 },
];

export async function forecastRange(city: string, from: string, to: string): Promise<any[]> {
  const result: any[] = [];
  let cursor = from;
  let index = 0;
  while (cursor <= to && index < 31) {
    const cond = CONDITIONS[index % CONDITIONS.length];
    if (!cond) break;
    const base = index % 5;
    const forecast = {
      date: cursor,
      conditionCode: cond.code,
      conditionText: cond.text,
      temperatureMin: 24 + base,
      temperatureMax: 29 + base,
      humidityPercent: 55 + ((index * 7) % 30),
      precipitationProbability: cond.rain + (index % 3) * 5,
      windDirection: ["东风", "南风", "西风", "北风"][index % 4] ?? null,
      windLevel: `${1 + (index % 4)}级`,
      airQuality: ["优", "良", "轻度污染"][index % 3] ?? null,
      warningCodes: cond.code === "thunderstorm" ? ["storm"] : [],
      updatedAt: new Date().toISOString(),
    };
    await db
      .collection("weatherCache")
      .doc(`${city}_${cursor}`)
      .set({
        data: {
          locationKey: `city:${city}`,
          timezone: "Asia/Shanghai",
          ...forecast,
          expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        },
      });
    result.push(forecast);
    cursor = addDays(cursor, 1);
    index += 1;
  }
  return result;
}

export async function get(openid: string, payload: { workspaceId: string; from: string; to: string; city?: string }) {
  await requireWorkspace(openid, payload.workspaceId);
  assertDate(payload.from);
  assertDate(payload.to);
  if (payload.from > payload.to) {
    throw new CloudError("VALIDATION_ERROR", "from 不能晚于 to");
  }
  return forecastRange(payload.city?.trim() || "深圳", payload.from, payload.to);
}

export async function getForDate(city: string, date: string): Promise<any | null> {
  assert(city, "VALIDATION_ERROR", "缺少城市");
  const list = await forecastRange(city, date, date);
  return list[0] ?? null;
}
