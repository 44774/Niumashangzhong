import { addDays } from "./time.js";

export interface CycleRule {
  startDate: string;
  endDate?: string | null;
  sequence: string[]; // shiftTemplateId 序列
  generationHorizonDays: number;
}

export interface GeneratedSlot {
  date: string;
  sequenceIndex: number;
  shiftTemplateId: string;
}

/**
 * 生成日期序列。空序列不可保存；结束日期与生成窗口取更早者。
 * 长期规则只生成窗口内的实例，不无限写入。
 */
export function generateCycleSlots(rule: CycleRule): GeneratedSlot[] {
  if (rule.sequence.length === 0) {
    throw new Error("班次序列不能为空");
  }
  const horizon = Math.max(1, rule.generationHorizonDays);
  const lastDate = rule.endDate
    ? minDate(rule.endDate, addDays(rule.startDate, horizon - 1))
    : addDays(rule.startDate, horizon - 1);
  if (lastDate < rule.startDate) return [];
  const slots: GeneratedSlot[] = [];
  let cursor = rule.startDate;
  let index = 0;
  while (cursor <= lastDate) {
    const shiftTemplateId = rule.sequence[index % rule.sequence.length];
    if (!shiftTemplateId) {
      throw new Error("班次序列包含空项");
    }
    slots.push({ date: cursor, sequenceIndex: index, shiftTemplateId });
    index += 1;
    cursor = addDays(cursor, 1);
  }
  return slots;
}

function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}
