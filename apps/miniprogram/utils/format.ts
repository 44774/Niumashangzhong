import type { ShiftSnapshot, WeatherForecast } from "../typings/api";

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function formatTimeRange(snapshot: ShiftSnapshot): string | null {
  if (!snapshot.startTime || !snapshot.endTime) return null;
  const endsNextDay =
    snapshot.endsNextDay || toMinutes(snapshot.endTime) <= toMinutes(snapshot.startTime);
  return endsNextDay
    ? `${snapshot.startTime}–次日${snapshot.endTime}`
    : `${snapshot.startTime}–${snapshot.endTime}`;
}

export function durationMinutes(snapshot: ShiftSnapshot): number {
  if (!snapshot.startTime || !snapshot.endTime) return 0;
  const start = toMinutes(snapshot.startTime);
  const end = toMinutes(snapshot.endTime);
  const endsNextDay =
    snapshot.endsNextDay || toMinutes(snapshot.endTime) <= toMinutes(snapshot.startTime);
  const raw = endsNextDay ? (end <= start ? end - start + 1440 : end - start) : end - start;
  return Math.max(0, raw - (snapshot.unpaidBreakMinutes || 0));
}

export function durationLabel(snapshot: ShiftSnapshot): string {
  const minutes = durationMinutes(snapshot);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} 分钟`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分`;
}

export function weatherSummary(weather: WeatherForecast | null): string {
  if (!weather) return "暂无天气数据";
  const temp = `${weather.temperatureMin}~${weather.temperatureMax}°C`;
  return `${weather.conditionText} ${temp}`;
}

export function weatherText(weather: WeatherForecast | null): string {
  if (!weather) return "";
  return `${weather.conditionText} ${weather.temperatureMin}~${weather.temperatureMax}°`;
}
