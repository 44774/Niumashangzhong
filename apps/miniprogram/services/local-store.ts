import type { ShiftTemplate } from "../typings/api";

export const LOCAL_TEMPLATES_KEY = "wc_local_templates";
export const LOCAL_SCHEDULES_KEY = "wc_local_schedules";
export const LOCAL_CHANGES_KEY = "wc_local_changes";
export const LOCAL_PREFS_KEY = "wc_local_prefs";
export const LOCAL_RULES_KEY = "wc_local_rules";
export const LOCAL_ACTIVE_RULE_KEY = "wc_active_rule_id";

export function read<T>(key: string, fallback: T): T {
  const value = wx.getStorageSync(key);
  return value ? (value as T) : fallback;
}

export function write(key: string, value: unknown): void {
  wx.setStorageSync(key, value);
}

export function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export const DEFAULT_LOCAL_TEMPLATES: ShiftTemplate[] = [
  {
    id: "t-morning",
    name: "早班",
    shortName: "早班",
    kind: "work",
    color: "#10B981",
    startTime: "09:00",
    endTime: "17:30",
    endsNextDay: false,
    unpaidBreakMinutes: 0,
    defaultLocationId: null,
    version: 1,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: "t-evening",
    name: "晚班",
    shortName: "晚班",
    kind: "work",
    color: "#2F80ED",
    startTime: "13:00",
    endTime: "21:30",
    endsNextDay: false,
    unpaidBreakMinutes: 0,
    defaultLocationId: null,
    version: 1,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: "t-night",
    name: "夜班",
    shortName: "夜班",
    kind: "work",
    color: "#7C3AED",
    startTime: "21:00",
    endTime: "07:00",
    endsNextDay: true,
    unpaidBreakMinutes: 0,
    defaultLocationId: null,
    version: 1,
    isActive: true,
    sortOrder: 3,
  },
  {
    id: "t-rest",
    name: "休息",
    shortName: "休",
    kind: "rest",
    color: "#94A3B8",
    startTime: null,
    endTime: null,
    endsNextDay: false,
    unpaidBreakMinutes: 0,
    defaultLocationId: null,
    version: 1,
    isActive: true,
    sortOrder: 4,
  },
];
