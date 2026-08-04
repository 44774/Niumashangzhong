import { api } from "../../services/api";
import { getToken } from "../../stores/session";
import { formatDateShort, todayString, weekdayCN, weekRange } from "../../utils/date";
import { formatTimeRange, weatherText } from "../../utils/format";

interface WeekRow {
  date: string;
  day: string;
  weekday: string;
  isToday: boolean;
  instanceId: string;
  shiftName: string;
  shiftShortName: string;
  shiftColor: string;
  timeText: string;
  weatherText: string;
}

Page({
  data: {
    rows: [] as WeekRow[],
    rangeLabel: "",
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

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  async load() {
    this.setData({ loading: true, error: false });
    try {
      const today = todayString();
      const days = weekRange(today);
      const [schedules, weathers] = await Promise.all([
        api.schedules(days[0], days[days.length - 1]),
        api.weather(days[0], days[days.length - 1]),
      ]);
      const instanceByDate = new Map(schedules.map((s) => [s.businessDate, s]));
      const weatherByDate = new Map(weathers.map((w) => [w.date, w]));
      const rows: WeekRow[] = days.map((date) => {
        const instance = instanceByDate.get(date);
        const weather = weatherByDate.get(date);
        const day = date.split("-")[2] ?? "";
        return {
          date,
          day: String(Number(day)),
          weekday: weekdayCN(date),
          isToday: date === today,
          instanceId: instance?.id ?? "",
          shiftName: instance?.shiftSnapshot.name ?? "",
          shiftShortName: instance?.shiftSnapshot.shortName ?? "",
          shiftColor: instance?.shiftSnapshot.color ?? "#1F6FEB",
          timeText: instance ? formatTimeRange(instance.shiftSnapshot) ?? "" : "",
          weatherText: weather ? weatherText(weather) : "",
        };
      });
      this.setData({
        rows,
        rangeLabel: `${formatDateShort(days[0])} – ${formatDateShort(days[days.length - 1])}`,
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

  onRowTap(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string;
    const date = event.currentTarget.dataset.date as string;
    wx.navigateTo({
      url: id
        ? `/pages/schedule-detail/index?id=${id}`
        : `/pages/schedule-detail/index?date=${date}`,
    });
  },

  goCalendar() {
    wx.switchTab({ url: "/pages/calendar/index" });
  },
});
