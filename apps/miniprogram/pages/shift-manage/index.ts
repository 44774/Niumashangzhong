import { api } from "../../services/api";
import { getToken } from "../../stores/session";
import type { ShiftKind, ShiftTemplate } from "../../typings/api";

const COLOR_OPTIONS = ["#10B981", "#2F80ED", "#7C3AED", "#F59E0B", "#EF4444", "#06B6D4", "#1F6FEB", "#94A3B8"];
const KINDS: Array<{ value: ShiftKind; label: string }> = [
  { value: "work", label: "工作" },
  { value: "rest", label: "休息" },
  { value: "leave", label: "请假" },
  { value: "training", label: "培训" },
  { value: "travel", label: "出差" },
  { value: "custom", label: "自定义" },
];

Page({
  data: {
    templates: [] as ShiftTemplate[],
    loading: true,
    error: false,
    errorMessage: "",
    showForm: false,
    editingId: "",
    saving: false,
    kindLabels: KINDS.map((k) => k.label),
    kindIndex: 0,
    colorOptions: COLOR_OPTIONS,
    form: {
      name: "",
      shortName: "",
      kind: "work" as ShiftKind,
      color: "#10B981",
      startTime: "09:00",
      endTime: "17:30",
      endsNextDay: false,
      unpaidBreakMinutes: 0,
    },
  },

  onShow() {
    if (!getToken()) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    this.load();
  },

  async load() {
    this.setData({ loading: true, error: false });
    try {
      const templates = await api.shiftTemplates(false);
      this.setData({ templates, loading: false });
    } catch (err) {
      this.setData({
        loading: false,
        error: true,
        errorMessage: (err as Error).message,
      });
    }
  },

  openCreate() {
    this.setData({
      showForm: true,
      editingId: "",
      kindIndex: 0,
      form: {
        name: "",
        shortName: "",
        kind: "work",
        color: "#10B981",
        startTime: "09:00",
        endTime: "17:30",
        endsNextDay: false,
        unpaidBreakMinutes: 0,
      },
    });
  },

  openEdit(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index);
    const template = this.data.templates[index];
    if (!template) return;
    const kindIndex = Math.max(0, KINDS.findIndex((k) => k.value === template.kind));
    this.setData({
      showForm: true,
      editingId: template.id,
      kindIndex,
      form: {
        name: template.name,
        shortName: template.shortName,
        kind: template.kind,
        color: template.color,
        startTime: template.startTime ?? "09:00",
        endTime: template.endTime ?? "17:30",
        endsNextDay: template.endsNextDay,
        unpaidBreakMinutes: template.unpaidBreakMinutes,
      },
    });
  },

  closeForm() {
    this.setData({ showForm: false });
  },

  noop() {},

  onNameInput(event: WechatMiniprogram.Input) {
    this.setData({ form: { ...this.data.form, name: event.detail.value } });
  },

  onShortNameInput(event: WechatMiniprogram.Input) {
    this.setData({ form: { ...this.data.form, shortName: event.detail.value } });
  },

  onKindChange(event: WechatMiniprogram.PickerChange) {
    const kindIndex = Number(event.detail.value);
    const kind = KINDS[kindIndex]?.value ?? "work";
    this.setData({ kindIndex, form: { ...this.data.form, kind } });
  },

  onColorPick(event: WechatMiniprogram.TouchEvent) {
    this.setData({ form: { ...this.data.form, color: event.currentTarget.dataset.color as string } });
  },

  onTimeChange(event: WechatMiniprogram.CustomEvent<{ field: string; value: unknown }>) {
    this.setData({ form: { ...this.data.form, [event.detail.field]: event.detail.value } });
  },

  onBreakInput(event: WechatMiniprogram.Input) {
    this.setData({
      form: { ...this.data.form, unpaidBreakMinutes: Number(event.detail.value) || 0 },
    });
  },

  async save() {
    const form = this.data.form;
    if (!form.name.trim() || !form.shortName.trim()) {
      wx.showToast({ title: "请填写名称与简称", icon: "none" });
      return;
    }
    this.setData({ saving: true });
    try {
      const input = {
        name: form.name.trim(),
        shortName: form.shortName.trim(),
        kind: form.kind,
        color: form.color,
        startTime: form.kind === "rest" ? null : form.startTime,
        endTime: form.kind === "rest" ? null : form.endTime,
        endsNextDay: form.endsNextDay,
        unpaidBreakMinutes: form.unpaidBreakMinutes,
      };
      if (this.data.editingId) {
        const current = this.data.templates.find((t) => t.id === this.data.editingId);
        await api.updateShiftTemplate(this.data.editingId, {
          ...input,
          version: current?.version ?? 1,
        });
      } else {
        await api.createShiftTemplate(input);
      }
      wx.showToast({ title: "已保存", icon: "success" });
      this.setData({ showForm: false });
      this.load();
    } catch (err) {
      wx.showToast({ title: (err as Error).message, icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },

  deactivate(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index);
    const template = this.data.templates[index];
    if (!template) return;
    wx.showModal({
      title: "停用班次",
      content: `停用后新排班不再使用“${template.name}”，历史排班不受影响。`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.updateShiftTemplate(template.id, {
            name: template.name,
            shortName: template.shortName,
            kind: template.kind,
            color: template.color,
            startTime: template.startTime,
            endTime: template.endTime,
            endsNextDay: template.endsNextDay,
            unpaidBreakMinutes: template.unpaidBreakMinutes,
            version: template.version,
            isActive: false,
          });
          wx.showToast({ title: "已停用", icon: "success" });
          this.load();
        } catch (err) {
          wx.showToast({ title: (err as Error).message, icon: "none" });
        }
      },
    });
  },
});
