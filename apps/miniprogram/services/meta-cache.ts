import { api } from "./api";
import { cachedLoad, invalidateCache } from "./cache";
import type { ScheduleRuleSummary, ShiftTemplate } from "../typings/api";

const RULES_KEY = "wc_rule_cache";
const TEMPLATES_KEY = "wc_templates_cache";
const ACTIVE_KEY = "wc_active_rule_cache";
const TTL = 5 * 60 * 1000;

export function getRulesCached(): Promise<ScheduleRuleSummary[]> {
  return cachedLoad(RULES_KEY, TTL, () => api.listRules());
}

export function invalidateRulesCache(): void {
  invalidateCache(RULES_KEY);
}

export function getTemplatesCached(): Promise<ShiftTemplate[]> {
  return cachedLoad(TEMPLATES_KEY, TTL, () => api.shiftTemplates(true));
}

export function invalidateTemplatesCache(): void {
  invalidateCache(TEMPLATES_KEY);
}

export function getActiveRuleCache(): ScheduleRuleSummary | null {
  return (wx.getStorageSync(ACTIVE_KEY) as ScheduleRuleSummary) || null;
}

export function setActiveRuleCache(rule: ScheduleRuleSummary | null): void {
  if (rule) {
    wx.setStorageSync(ACTIVE_KEY, rule);
  } else {
    wx.removeStorageSync(ACTIVE_KEY);
  }
}

export function invalidateActiveRuleCache(): void {
  wx.removeStorageSync(ACTIVE_KEY);
}
