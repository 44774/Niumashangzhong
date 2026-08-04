import { SUBSCRIBE_TEMPLATE_IDS } from "../../config";
import { api } from "../../services/api";
import { getToken } from "../../stores/session";
import type { NotificationPreferences } from "../../typings/api";

const REMINDER_CHOICES = [15, 30, 60, 120];

Page({
  data: {
    prefs: {
      shiftReminders: [15],
      weatherEnabled: true,
      scheduleChangesEnabled: true,
      approvalEnabled: true,
      holidayOvertimeEnabled: true,
      quietHours: null as { start: string; end: string } | null,
      channels: { wechat: true },
    } as NotificationPreferences,
    reminderOptions: REMINDER_CHOICES.map((value) => ({
      label: `${value} 分钟`,
      value,
      checked: true,
    })),
    saving: false,
    subscribeStatus: "",
  },

  onShow() {
    if (!getToken()) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    this.load();
  },

  async load() {
    try {
      const prefs = await api.notificationPreferences();
      const reminderOptions = REMINDER_CHOICES.map((value) => ({
        label: `${value} 分钟`,
        value,
        checked: prefs.shiftReminders.includes(value),
      }));
      this.setData({ prefs, reminderOptions });
    } catch (err) {
      wx.showToast({ title: (err as Error).message, icon: "none" });
    }
  },

  toggleReminder(event: WechatMiniprogram.TouchEvent) {
    const value = Number(event.currentTarget.dataset.value);
    const options = this.data.reminderOptions.map((item) =>
      item.value === value ? { ...item, checked: !item.checked } : item,
    );
    const shiftReminders = options.filter((item) => item.checked).map((item) => item.value);
    this.setData({
      reminderOptions: options,
      prefs: { ...this.data.prefs, shiftReminders },
    });
  },

  onWeatherChange(event: WechatMiniprogram.SwitchChange) {
    this.setData({ prefs: { ...this.data.prefs, weatherEnabled: Boolean(event.detail.value) } });
  },

  onScheduleChangeToggle(event: WechatMiniprogram.SwitchChange) {
    this.setData({
      prefs: { ...this.data.prefs, scheduleChangesEnabled: Boolean(event.detail.value) },
    });
  },

  onHolidayToggle(event: WechatMiniprogram.SwitchChange) {
    this.setData({
      prefs: { ...this.data.prefs, holidayOvertimeEnabled: Boolean(event.detail.value) },
    });
  },

  onQuietStart(event: WechatMiniprogram.PickerChange) {
    const quietHours = {
      start: String(event.detail.value),
      end: this.data.prefs.quietHours?.end ?? "07:00",
    };
    this.setData({ prefs: { ...this.data.prefs, quietHours } });
  },

  onQuietEnd(event: WechatMiniprogram.PickerChange) {
    const quietHours = {
      start: this.data.prefs.quietHours?.start ?? "22:30",
      end: String(event.detail.value),
    };
    this.setData({ prefs: { ...this.data.prefs, quietHours } });
  },

  subscribe() {
    if (SUBSCRIBE_TEMPLATE_IDS.length === 0) {
      wx.showModal({
        title: "开发模式",
        content: "当前未配置微信订阅消息模板 ID。配置 WECHAT_APPID 与模板 ID 后即可接收真实订阅消息。",
        showCancel: false,
      });
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: SUBSCRIBE_TEMPLATE_IDS,
      success: (res) => {
        const accepted = Object.values(res).filter((v) => v === "accept").length;
        this.setData({ subscribeStatus: `已授权 ${accepted} 个提醒模板` });
      },
      fail: () => {
        this.setData({ subscribeStatus: "订阅授权未完成" });
      },
    });
  },

  async save() {
    this.setData({ saving: true });
    try {
      await api.saveNotificationPreferences(this.data.prefs);
      wx.showToast({ title: "已保存", icon: "success" });
    } catch (err) {
      wx.showToast({ title: (err as Error).message, icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },
});
