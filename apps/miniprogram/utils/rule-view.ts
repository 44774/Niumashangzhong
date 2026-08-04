import type {
  ScheduleInstance,
  ScheduleRuleSummary,
  ShiftSnapshot,
  ShiftTemplate,
} from "../typings/api";
import { instanceTimes } from "./local-schedule";

function diffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty ?? 0, (tm ?? 1) - 1, td ?? 1) - Date.UTC(fy ?? 0, (fm ?? 1) - 1, fd ?? 1)) /
      86_400_000,
  );
}

function snapshotFromTemplate(tpl: ShiftTemplate): ShiftSnapshot {
  return {
    name: tpl.name,
    shortName: tpl.shortName,
    kind: tpl.kind,
    color: tpl.color,
    startTime: tpl.startTime,
    endTime: tpl.endTime,
    endsNextDay: tpl.endsNextDay,
    unpaidBreakMinutes: tpl.unpaidBreakMinutes,
  };
}

/** 按循环规则计算某一天的班次（不落库、纯本地计算）。 */
export function computeRuleInstance(
  rule: ScheduleRuleSummary,
  templateById: Map<string, ShiftTemplate>,
  date: string,
): ScheduleInstance | null {
  const offset = diffDays(rule.startDate, date);
  if (offset < 0) return null;
  if (rule.endDate && date > rule.endDate) return null;
  const sequence = rule.sequence ?? [];
  if (sequence.length === 0) return null;
  const item = sequence[offset % sequence.length];
  const tpl = item ? templateById.get(item.shiftTemplateId) : undefined;
  if (!tpl) return null;
  const snap = snapshotFromTemplate(tpl);
  const times = instanceTimes(date, snap);
  return {
    id: `rule:${rule.id}:${date}`,
    ownerUserId: "user",
    businessDate: date,
    timezone: rule.timezone || "Asia/Shanghai",
    startsAt: times.startsAt,
    endsAt: times.endsAt,
    kind: snap.kind,
    status: "scheduled",
    source: "rule",
    shiftSnapshot: snap,
    locationSnapshot: null,
    note: null,
    version: 1,
  };
}

/**
 * 合并：已存在实例优先（手动/已生成的规则实例），缺失日期用当前排班表本地计算补全。
 * 只补“当前排班表”（isCurrent 的规则），与日历展示规则一致。
 */
export function mergeSchedules(
  instances: ScheduleInstance[],
  rules: ScheduleRuleSummary[],
  templates: ShiftTemplate[],
  from: string,
  to: string,
): ScheduleInstance[] {
  const activeRule = rules.find((r) => r.isCurrent);
  const byDate = new Map(instances.map((i) => [i.businessDate, i]));
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const merged = [...instances];
  if (activeRule) {
    let cursor = from;
    while (cursor <= to) {
      if (!byDate.has(cursor)) {
        const virtual = computeRuleInstance(activeRule, templateById, cursor);
        if (virtual) merged.push(virtual);
      }
      cursor = addDaysLocal(cursor, 1);
    }
  }
  return merged.sort((a, b) => (a.businessDate < b.businessDate ? -1 : 1));
}

function addDaysLocal(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate(),
  ).padStart(2, "0")}`;
}
