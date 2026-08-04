import type { WeatherLocation } from "../typings/api";

const LOCATION_KEY = "wc_default_location";

export function getDefaultLocation(): WeatherLocation | null {
  return (wx.getStorageSync(LOCATION_KEY) as WeatherLocation) || null;
}

export function setDefaultLocation(location: WeatherLocation): void {
  wx.setStorageSync(LOCATION_KEY, location);
}

export function normalizeLocation(location?: WeatherLocation | string): WeatherLocation | undefined {
  if (!location) return undefined;
  if (typeof location === "string") return undefined;
  if (typeof location.latitude !== "number" || typeof location.longitude !== "number") {
    return undefined;
  }
  return location;
}
