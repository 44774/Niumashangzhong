import { api } from "./api";
import type { ScheduleDetail, ScheduleInstance } from "../typings/api";
import { mergeSchedules } from "../utils/rule-view";

/**
 * 从云端获取排班表（规则）与已有实例，缺失日期在本地按规则计算。
 * 云函数读接口不再逐个写库，因此查看未来排班不再有延迟。
 */
export async function loadRange(from: string, to: string): Promise<ScheduleInstance[]> {
  const [instances, rules, templates] = await Promise.all([
    api.schedules(from, to),
    api.listRules().catch(() => []),
    api.shiftTemplates(true),
  ]);
  return mergeSchedules(instances, rules, templates, from, to);
}

export async function loadDateDetail(date: string): Promise<ScheduleDetail | null> {
  const list = await loadRange(date, date);
  const instance = list[0];
  if (!instance) return null;
  if (!instance.id.startsWith("rule:")) {
    return api.scheduleDetail(instance.id);
  }
  const [weather] = await api.weather(date, date);
  return {
    ...instance,
    weather: weather ?? null,
    pendingChange: null,
    history: [],
  };
}
