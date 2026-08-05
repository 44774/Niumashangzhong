import { SUBSCRIBE_TEMPLATE_IDS } from "../../config";
import { api } from "../../services/api";
import { getToken } from "../../stores/session";
import type {
  NotificationPreferences,
  NotificationSubscription,
  SubscribeTemplateInfo,
} from "../../typings/api";

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
    subscribing: false,
    subscribeTemplates: [] as SubscribeTemplateInfo[],
    subscriptionStatus: {} as Record<string, string>,
  },

  onShow() {
    this.setTabBarSelected(2);
    if (!getToken()) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    this.load();
  },

  setTabBarSelected(index: number) {
    const tabBar = this.getTabBar?.();
    if (tabBar) {
      (tabBar as unknown as { setData: (data: { selected: number }) => void }).setData({
        selected: index,
      });
    }
  },

  async load() {
    try {
      const [prefs, templates] = await Promise.all([
        api.notificationPreferences(),
        api.subscribeTemplates().catch(() => []),
      ]);
      const reminderOptions = REMINDER_CHOICES.map((value) => ({
        label: `${value} 分钟`,
        value,
        checked: prefs.shiftReminders.includes(value),
      }));
      this.setData({
        prefs,
        reminderOptions,
        subscribeTemplates:
          SUBSCRIBE_TEMPLATE_IDS.length > 0 && templates.length === 0
            ? SUBSCRIBE_TEMPLATE_IDS.map((templateId, index) => ({
                key: index === 0 ? "shift_reminder" : "weather_reminder",
                templateId,
                page: "/pages/calendar/index",
                name: index === 0 ? "上班提醒" : "天气提醒",
              }))
            : templates,
        subscriptionStatus: this.buildSubscriptionStatus(prefs.subscriptions ?? []),
      });
    } catch (err) {
      wx.showToast({ title: (err as Error).message, icon: "none" });
    }
  },

  buildSubscriptionStatus(subscriptions: NotificationSubscription[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (const sub of subscriptions) {
      if (sub.status === "accepted") map[sub.templateId] = "已授权";
      else if (sub.status === "rejected") map[sub.templateId] = "已拒绝";
      else if (sub.status === "banned") map[sub.templateId] = "已被禁用";
      else map[sub.templateId] = "状态未知";
    }
    return map;
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

  async subscribe() {
    const templates = this.data.subscribeTemplates;
    if (templates.length === 0) {
      wx.showModal({
        title: "暂未配置模板",
        content:
          "当前未配置微信订阅消息模板 ID。请在微信公众平台添加订阅消息模板，并在云函数环境变量中配置后重新部署。",
        showCancel: false,
      });
      return;
    }
    if (this.data.subscribing) return;
    this.setData({ subscribing: true, subscribeStatus: "" });
    try {
      const res = await this.requestSubscribe(templates.map((t) => t.templateId));
      const subscriptions: NotificationSubscription[] = templates.map((t) => ({
        key: t.key,
        templateId: t.templateId,
        status:
          res[t.templateId] === "accept"
            ? "accepted"
            : res[t.templateId] === "reject"
              ? "rejected"
              : res[t.templateId] === "ban"
                ? "banned"
                : "unknown",
        grantedAt: new Date().toISOString(),
      }));
      await api.saveSubscriptions(subscriptions);
      const accepted = subscriptions.filter((s) => s.status === "accepted").length;
      this.setData({
        subscribeStatus: `已授权 ${accepted} 个提醒模板`,
        subscriptionStatus: this.buildSubscriptionStatus(subscriptions),
      });
    } catch (err) {
      this.setData({ subscribeStatus: "订阅授权未完成，请重试" });
      wx.showToast({ title: (err as Error).message, icon: "none" });
    } finally {
      this.setData({ subscribing: false });
    }
  },

  requestSubscribe(tmplIds: string[]): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
      wx.requestSubscribeMessage({
        tmplIds,
        success: (res) => resolve(res as unknown as Record<string, string>),
        fail: () => reject(new Error("订阅授权未完成")),
      });
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
