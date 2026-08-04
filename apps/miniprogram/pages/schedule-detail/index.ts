import { api } from "../../services/api";
import { getToken } from "../../stores/session";
import type { ScheduleDetail } from "../../typings/api";
import { formatDateCN, todayString, weekdayCN } from "../../utils/date";
import { durationLabel, formatTimeRange } from "../../utils/format";
import { ensureHolidayRange } from "../../services/holiday-cache";
import { isOvertime } from "../../utils/holiday";
import { loadDateDetail } from "../../services/schedule-view";
import type { ChangeRequest } from "../../typings/api";
import { clearCalendarCache } from "../../services/calendar-cache";

Page({
  data: {
    detail: null as ScheduleDetail | null,
    dateLabel: "",
    date: "",
    timeText: "",
    duration: "",
    location: "",
    note: "",
    instanceId: "",
    loading: true,
    error: false,
    errorMessage: "",
    weatherError: false,
    overtime: false,
    isVirtual: false,
    changeRecords: [] as Array<ChangeRequest & { statusText: string; createdAtText: string }>,
  },

  onLoad(query: Record<string, string | undefined>) {
    const id = query.id;
    const date = query.date ?? todayString();
    this.setData({
      date,
      dateLabel: `${formatDateCN(date)} ${weekdayCN(date)}`,
    });
    this.setData({ instanceId: id ?? "" });
  },

  onShow() {
    if (!getToken()) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    if (this.data.instanceId || this.data.date) {
      this.load();
    }
  },

  async load() {
    this.setData({ loading: true, error: false });
    try {
      let detail: ScheduleDetail;
      if (this.data.instanceId) {
        detail = await api.scheduleDetail(this.data.instanceId);
      } else {
        const date = this.data.date || todayString();
        const virtualDetail = await loadDateDetail(date);
        if (!virtualDetail) {
          this.setData({ loading: false, detail: null });
          return;
        }
        detail = virtualDetail;
      }
      const snapshot = detail.shiftSnapshot;
      const holidayMap = await ensureHolidayRange(detail.businessDate, detail.businessDate);
      const overtime =
        detail.overtime ?? isOvertime(holidayMap, detail.businessDate, detail.kind);
      const history = detail.history.map((h) => {
        const d = new Date(h.createdAt);
        const pad = (n: number) => String(n).padStart(2, "0");
        return {
          ...h,
          createdAtText: `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
        };
      });
      const changes = await api
        .changeRequestsInRange(detail.businessDate, detail.businessDate)
        .catch(() => []);
      const changeRecords = changes.map((c) => {
        const d = new Date(c.createdAt);
        const pad = (n: number) => String(n).padStart(2, "0");
        return {
          ...c,
          statusText: "已生效",
          createdAtText: `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
        };
      });
      this.setData({
        detail: { ...detail, history },
        changeRecords,
        dateLabel: `${formatDateCN(detail.businessDate)} ${weekdayCN(detail.businessDate)}`,
        timeText: formatTimeRange(snapshot) ?? "",
        duration: durationLabel(snapshot),
        location: detail.locationSnapshot?.name ?? "",
        note: detail.note ?? "",
        weatherError: !detail.weather,
        overtime,
        isVirtual: detail.id.startsWith("rule:"),
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

  extractDate(): string {
    return this.data.date || this.data.detail?.businessDate || todayString();
  },

  changeShift() {
    if (!this.data.detail) return;
    const url = this.data.isVirtual
      ? `/pages/schedule-change/index?date=${this.data.detail.businessDate}`
      : `/pages/schedule-change/index?id=${this.data.detail.id}`;
    wx.navigateTo({ url });
  },

  shareSchedule() {
    if (!this.data.detail) return;
    wx.navigateTo({ url: `/pages/share/index?date=${this.data.detail.businessDate}` });
  },

  addSchedule() {
    wx.navigateTo({ url: `/pages/schedule-change/index?date=${this.extractDate()}` });
  },

  removeChangeRecord(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string;
    wx.showModal({
      title: "删除改班记录",
      content: "删除后该条临时改班记录将移除（排班本身不受影响）。确定删除吗？",
      confirmText: "删除",
      confirmColor: "#EF4444",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.removeChangeRequest(id);
          clearCalendarCache();
          const date = this.data.detail?.businessDate ?? this.data.date;
          const changes = await api
            .changeRequestsInRange(date, date)
            .catch(() => []);
          const changeRecords = changes.map((c) => {
            const d = new Date(c.createdAt);
            const pad = (n: number) => String(n).padStart(2, "0");
            return {
              ...c,
              statusText: "已生效",
              createdAtText: `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
            };
          });
          this.setData({ changeRecords });
          wx.showToast({ title: "已删除", icon: "success" });
        } catch (err) {
          wx.showToast({ title: (err as Error).message, icon: "none" });
        }
      },
    });
  },
});
