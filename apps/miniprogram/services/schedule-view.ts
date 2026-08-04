import { api } from "./api";
import type { ScheduleDetail, ScheduleInstance } from "../typings/api";
import { mergeSchedules } from "../utils/rule-view";
import {
  getActiveRuleCache,
  getRulesCached,
  getTemplatesCached,
  setActiveRuleCache,
} from "./meta-cache";
import { getWeatherCached } from "./weather-cache";

/**
 * 从云端获取排班表（规则）与已有实例，缺失日期在本地按规则计算。
 * 云函数读接口不再逐个写库，因此查看未来排班不再有延迟。
 */
export async function loadRange(from: string, to: string): Promise<ScheduleInstance[]> {
  const [instances, rules, templates] = await Promise.all([
    api.schedules(from, to),
    getRulesCached().catch(() => []),
    getTemplatesCached().catch(() => []),
  ]);
  let active = rules.find((r) => r.isCurrent);
  if (!active) {
    const cachedActive = getActiveRuleCache();
    if (cachedActive) active = { ...cachedActive, isCurrent: true };
  }
  if (active) setActiveRuleCache(active);
  const merged = mergeSchedules(instances, active ? [active] : [], templates, from, to);
  return merged;
}

export async function loadDateDetail(date: string): Promise<ScheduleDetail | null> {
  const list = await loadRange(date, date);
  const instance = list[0];
  if (!instance) return null;
  if (!instance.id.startsWith("rule:")) {
    return api.scheduleDetail(instance.id);
  }
  const [weather] = await getWeatherCached(date, date);
  return {
    ...instance,
    weather: weather ?? null,
    pendingChange: null,
    history: [],
  };
}
