import { api } from "../../services/api";
import { getToken } from "../../stores/session";
import type { ScheduleRuleInput, ShiftTemplate } from "../../typings/api";
import { addDays, todayString } from "../../utils/date";
import { cycleSlots } from "../../utils/local-schedule";

Page({
  data: {
    loading: true,
    error: false,
    errorMessage: "",
    templates: [] as ShiftTemplate[],
    templateNames: [] as string[],
    sequence: [] as Array<{ templateId: string; templateIndex: number; name: string }>,
    startDate: "",
    endStrategy: "open" as "open" | "endDate",
    endDate: "",
    preview: [] as Array<{ date: string; name: string; color: string }>,
    submitting: false,
  },

  onLoad() {
    this.setData({ startDate: todayString(), endDate: addDays(todayString(), 30) });
    this.load();
  },

  onShow() {
    if (!getToken()) {
      wx.reLaunch({ url: "/pages/login/index" });
    }
  },

  async load() {
    this.setData({ loading: true, error: false });
    try {
      const templates = await api.shiftTemplates(true);
      this.setData({
        templates,
        templateNames: templates.map((t) => t.name),
        sequence: [],
        loading: false,
      });
    } catch (err) {
      this.setData({ loading: false, error: true, errorMessage: (err as Error).message });
    }
  },

  addSequence() {
    const sequence = [...this.data.sequence];
    if (sequence.length >= 14) return;
    sequence.push({ templateId: "", templateIndex: 0, name: "" });
    this.setData({ sequence });
    this.refreshPreview();
  },

  removeSequence(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index);
    const sequence = this.data.sequence.filter((_, i) => i !== index);
    this.setData({ sequence });
    this.refreshPreview();
  },

  onSequenceChange(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.currentTarget.dataset.index);
    const templateIndex = Number(event.detail.value);
    const template = this.data.templates[templateIndex];
    const sequence = this.data.sequence.map((item, i) =>
      i === index
        ? { templateId: template?.id ?? "", templateIndex, name: template?.name ?? "" }
        : item,
    );
    this.setData({ sequence });
    this.refreshPreview();
  },

  onStartDateChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ startDate: String(event.detail.value) });
    this.refreshPreview();
  },

  onEndDateChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ endDate: String(event.detail.value) });
  },

  onStrategyChange(event: WechatMiniprogram.TouchEvent) {
    this.setData({ endStrategy: event.currentTarget.dataset.value as "open" | "endDate" });
  },

  refreshPreview() {
    const { startDate, sequence, templates } = this.data;
    if (sequence.length === 0 || !startDate) {
      this.setData({ preview: [] });
      return;
    }
    const ids = sequence.map((s) => s.templateId);
    const slots = cycleSlots(startDate, ids, 14);
    const templateById = new Map(templates.map((t) => [t.id, t]));
    const preview = slots
      .filter((s) => s.shiftTemplateId)
      .map((s) => {
        const tpl = templateById.get(s.shiftTemplateId);
        return { date: s.date, name: tpl?.name ?? "", color: tpl?.color ?? "#1F6FEB" };
      });
    this.setData({ preview });
  },

  async submit() {
    const { sequence, startDate, endStrategy, endDate } = this.data;
    if (sequence.length === 0) {
      wx.showToast({ title: "请至少添加一个班次", icon: "none" });
      return;
    }
    if (sequence.some((s) => !s.templateId)) {
      wx.showToast({ title: "请为序列中的每一项选择班次", icon: "none" });
      return;
    }
    const horizon = 90;
    const input: ScheduleRuleInput = {
      ownerUserId: "",
      startDate,
      endDate: endStrategy === "endDate" ? endDate : null,
      timezone: "Asia/Shanghai",
      sequence: sequence.map((s) => ({ shiftTemplateId: s.templateId })),
      generationHorizonDays: horizon,
    };
    this.setData({ submitting: true });
    try {
      const result = await api.createRule(input);
      wx.showToast({
        title: `已生成 ${result.generatedCount} 天`,
        icon: "success",
      });
      if (result.conflicts.length > 0) {
        wx.showModal({
          title: "存在排班冲突",
          content: `检测到 ${result.conflicts.length} 处时间重叠，已生成的实例已保留，请到日历中检查。`,
          showCancel: false,
        });
      }
      setTimeout(() => wx.navigateBack({ delta: 1 }), 800);
    } catch (err) {
      wx.showToast({ title: (err as Error).message, icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
