import { api } from "../../services/api";
import { getToken } from "../../stores/session";
import type { ScheduleDetail } from "../../typings/api";
import { formatDateCN, todayString, weekdayCN } from "../../utils/date";
import { durationLabel, formatTimeRange } from "../../utils/format";
import { ensureHolidayRange } from "../../services/holiday-cache";
import { isOvertime } from "../../utils/holiday";

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
        const list = await api.schedules(date, date);
        if (list.length === 0) {
          this.setData({ loading: false, detail: null });
          return;
        }
        detail = await api.scheduleDetail(list[0].id);
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
      this.setData({
        detail: { ...detail, history },
        dateLabel: `${formatDateCN(detail.businessDate)} ${weekdayCN(detail.businessDate)}`,
        timeText: formatTimeRange(snapshot) ?? "",
        duration: durationLabel(snapshot),
        location: detail.locationSnapshot?.name ?? "",
        note: detail.note ?? "",
        weatherError: !detail.weather,
        overtime,
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
    wx.navigateTo({ url: `/pages/schedule-change/index?id=${this.data.detail.id}` });
  },

  shareSchedule() {
    if (!this.data.detail) return;
    wx.navigateTo({ url: `/pages/share/index?date=${this.data.detail.businessDate}` });
  },

  addSchedule() {
    wx.navigateTo({ url: `/pages/schedule-change/index?date=${this.extractDate()}` });
  },
});
