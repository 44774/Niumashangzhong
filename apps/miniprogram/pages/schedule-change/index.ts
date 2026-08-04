import { api } from "../../services/api";
import type { ScheduleDetail, ShiftTemplate } from "../../typings/api";
import { formatDateCN, todayString, weekdayCN } from "../../utils/date";
import { formatTimeRange } from "../../utils/format";

const COLOR_OPTIONS = ["#10B981", "#2F80ED", "#7C3AED", "#F59E0B", "#EF4444", "#06B6D4", "#1F6FEB"];

Page({
  data: {
    mode: "create" as "create" | "change",
    date: "",
    dateLabel: "",
    original: null as ScheduleDetail | null,
    originalTimeText: "",
    templates: [] as ShiftTemplate[],
    templateNames: [] as string[],
    templateIndex: 0,
    selectedTemplateName: "",
    customMode: false,
    form: {
      name: "",
      color: "#1F6FEB",
      startTime: "09:00",
      endTime: "17:30",
      endsNextDay: false,
    },
    colorOptions: COLOR_OPTIONS,
    reason: "",
    loading: true,
    error: false,
    errorMessage: "",
    submitting: false,
  },

  onLoad(query: Record<string, string | undefined>) {
    const id = query.id ?? "";
    const date = query.date ?? todayString();
    this.setData({ mode: id ? "change" : "create", date });
    this.load(id, date);
  },

  async load(id: string, date: string) {
    this.setData({ loading: true, error: false });
    try {
      const [templates, original] = await Promise.all([
        api.shiftTemplates(true),
        id ? api.scheduleDetail(id) : Promise.resolve(null),
      ]);
      const templateNames = templates.map((t) => `${t.name}（${t.startTime ?? "全天"}）`);
      this.setData({
        templates,
        templateNames,
        templateIndex: 0,
        selectedTemplateName: templates[0]?.name ?? "",
        original,
        originalTimeText: original
          ? formatTimeRange(original.shiftSnapshot) ?? "休息"
          : "",
        dateLabel: `${formatDateCN(date)} ${weekdayCN(date)}`,
        loading: false,
      });
    } catch (err) {
      this.setData({
        loading: false,
        error: true,
        errorMessage: (err as Error).message,
      });
    }
  },

  onTemplateChange(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.detail.value);
    const template = this.data.templates[index];
    if (!template) return;
    this.setData({
      templateIndex: index,
      selectedTemplateName: template.name,
      form: {
        name: template.name,
        color: template.color,
        startTime: template.startTime ?? "09:00",
        endTime: template.endTime ?? "17:30",
        endsNextDay: template.endsNextDay,
      },
    });
  },

  onCustomMode(event: WechatMiniprogram.SwitchChange) {
    this.setData({ customMode: Boolean(event.detail.value) });
  },

  onTimeChange(event: WechatMiniprogram.CustomEvent<{ field: string; value: unknown }>) {
    const field = event.detail.field;
    const value = event.detail.value;
    this.setData({ form: { ...this.data.form, [field]: value } });
  },

  onNameInput(event: WechatMiniprogram.Input) {
    this.setData({ form: { ...this.data.form, name: event.detail.value } });
  },

  onColorPick(event: WechatMiniprogram.TouchEvent) {
    this.setData({ form: { ...this.data.form, color: event.currentTarget.dataset.color as string } });
  },

  onReasonInput(event: WechatMiniprogram.TextareaInput) {
    this.setData({ reason: event.detail.value });
  },

  async submit() {
    if (this.data.submitting) return;
    const template = this.data.templates[this.data.templateIndex];
    const hasTemplate = !this.data.customMode && template;
    if (!hasTemplate) {
      if (!this.data.form.startTime || !this.data.form.endTime) {
        wx.showToast({ title: "请填写开始与结束时间", icon: "none" });
        return;
      }
      if (!this.data.form.name.trim()) {
        wx.showToast({ title: "请填写班次名称", icon: "none" });
        return;
      }
    }
    this.setData({ submitting: true });
    try {
      if (this.data.mode === "change" && this.data.original) {
        await api.createChangeRequest({
          scheduleInstanceId: this.data.original.id,
          shiftTemplateId: hasTemplate ? template.id : null,
          requestedShift: hasTemplate
            ? {
                name: template.name,
                kind: template.kind,
                startTime: template.startTime,
                endTime: template.endTime,
                endsNextDay: template.endsNextDay,
                color: template.color,
                unpaidBreakMinutes: template.unpaidBreakMinutes,
              }
            : {
                name: this.data.form.name.trim(),
                kind: this.data.form.startTime && this.data.form.endTime ? "work" : "rest",
                startTime: this.data.form.startTime,
                endTime: this.data.form.endTime,
                endsNextDay: this.data.form.endsNextDay,
                color: this.data.form.color,
              },
          reason: this.data.reason.trim() || "临时改班",
        });
        wx.showToast({ title: "已修改当天班次", icon: "success" });
      } else {
        await api.createSchedule({
          ownerUserId: "",
          businessDate: this.data.date,
          shiftTemplateId: hasTemplate ? template.id : null,
          customShift: hasTemplate
            ? undefined
            : {
                name: this.data.form.name.trim(),
                kind: this.data.form.startTime && this.data.form.endTime ? "work" : "rest",
                startTime: this.data.form.startTime,
                endTime: this.data.form.endTime,
                endsNextDay: this.data.form.endsNextDay,
                color: this.data.form.color,
              },
          note: this.data.reason.trim() || null,
        });
        wx.showToast({ title: "排班已添加", icon: "success" });
      }
      setTimeout(() => wx.navigateBack({ delta: 1 }), 600);
    } catch (err) {
      wx.showToast({ title: (err as Error).message, icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
