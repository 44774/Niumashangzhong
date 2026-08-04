import { getToken } from "../../stores/session";
import { formatDateShort, todayString, weekdayCN, weekRange } from "../../utils/date";
import { formatTimeRange, weatherText } from "../../utils/format";
import { ensureHolidayRange } from "../../services/holiday-cache";
import { isOvertime } from "../../utils/holiday";
import { loadRange } from "../../services/schedule-view";
import { getWeatherCached } from "../../services/weather-cache";

interface WeekRow {
  date: string;
  day: string;
  weekday: string;
  isToday: boolean;
  instanceId: string;
  shiftName: string;
  shiftShortName: string;
  shiftColor: string;
  overtime: boolean;
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
    this.setData({ loading: this.data.rows.length === 0, error: false });
    try {
      const today = todayString();
      const days = weekRange(today);
      const [schedules, weathers, holidayMap] = await Promise.all([
        loadRange(days[0], days[days.length - 1]),
        getWeatherCached(days[0], days[days.length - 1]),
        ensureHolidayRange(days[0], days[days.length - 1]),
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
          overtime: isOvertime(holidayMap, date, instance?.kind ?? "rest"),
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
      if (this.data.rows.length === 0) {
        this.setData({
          loading: false,
          error: true,
          errorMessage: (err as Error).message,
        });
      } else {
        this.setData({ loading: false });
      }
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
