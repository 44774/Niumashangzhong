import { api } from "../../services/api";
import { getToken } from "../../stores/session";
import type { ScheduleRuleSummary } from "../../typings/api";

Page({
  data: {
    rules: [] as ScheduleRuleSummary[],
    loading: true,
    error: false,
    errorMessage: "",
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
      const rules = await api.listRules();
      this.setData({ rules, loading: false });
    } catch (err) {
      this.setData({ loading: false, error: true, errorMessage: (err as Error).message });
    }
  },

  createSchedule() {
    wx.navigateTo({ url: "/pages/cycle-create/index" });
  },

  async switchRule(event: WechatMiniprogram.TouchEvent) {
    const ruleId = event.currentTarget.dataset.id as string;
    try {
      await api.switchRule(ruleId);
      wx.showToast({ title: "已切换", icon: "success" });
      this.load();
    } catch (err) {
      wx.showToast({ title: (err as Error).message, icon: "none" });
    }
  },

  removeRule(event: WechatMiniprogram.TouchEvent) {
    const ruleId = event.currentTarget.dataset.id as string;
    const name = event.currentTarget.dataset.name as string;
    wx.showModal({
      title: "删除排班表",
      content: `确定删除“${name}”吗？该排班表生成的班次会被移除，手动排班不受影响。`,
      confirmText: "删除",
      confirmColor: "#EF4444",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.removeRule(ruleId);
          wx.showToast({ title: "已删除", icon: "success" });
          this.load();
        } catch (err) {
          wx.showToast({ title: (err as Error).message, icon: "none" });
        }
      },
    });
  },
});
