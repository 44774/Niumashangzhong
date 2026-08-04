import type {
  ScheduleInstance,
  ShiftTemplate,
} from "../../typings/api";
import type { CalendarDayShift } from "../../components/calendar-month/index";
import { api } from "../../services/api";
import { getToken } from "../../stores/session";
import {
  buildMonthGrid,
  monthLabel,
  parseDate,
  threeMonthRange,
  todayString,
  weekdayCN,
} from "../../utils/date";
import { durationLabel, formatTimeRange } from "../../utils/format";
import { ensureHolidayRange } from "../../services/holiday-cache";
import { isOvertime } from "../../utils/holiday";
import { loadRange } from "../../services/schedule-view";
import {
  getCalendarWindow,
  setCalendarWindow,
  type CalendarWindowData,
} from "../../services/calendar-cache";

Page({
  data: {
    year: 0,
    month: 0,
    monthLabel: "",
    cells: [] as Array<{ date: string; day: number; inMonth: boolean; isToday: boolean }>,
    selectedDate: "",
    shiftMap: {} as Record<string, CalendarDayShift[]>,
    legend: [] as ShiftTemplate[],
    todaySummary: null as ScheduleInstance | null,
    todayLabel: "",
    todayTimeText: "",
    todayLocation: "",
    todayDuration: "",
    changeDates: [] as string[],
    loading: true,
    error: false,
    errorMessage: "",
    touchStartX: 0,
  },

  onShow() {
    if (!getToken()) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    this.initMonth();
    this.load();
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  initMonth() {
    const today = todayString();
    const { year, month } = parseDate(today);
    this.setData({
      year,
      month,
      monthLabel: monthLabel(year, month),
      cells: buildMonthGrid(year, month, today),
      selectedDate: today,
    });
  },

  async load() {
    if (!getToken()) return;
    const { from, to } = threeMonthRange(this.data.year, this.data.month);
    const cached = getCalendarWindow(this.data.year, this.data.month);
    if (cached) this.applyWindow(cached);
    this.setData({ loading: !cached, error: false });
    try {
      const today = todayString();
      const [templates, schedules, holidayMap, changes] = await Promise.all([
        api.shiftTemplates(true),
        loadRange(from, to),
        ensureHolidayRange(from, to),
        api.changeRequestsInRange(from, to).catch(() => []),
      ]);
      const shiftMap: Record<string, CalendarDayShift[]> = {};
      for (const item of schedules) {
        const list = shiftMap[item.businessDate] ?? [];
        list.push({
          name: item.shiftSnapshot.name,
          shortName: item.shiftSnapshot.shortName,
          color: item.shiftSnapshot.color,
          overtime: isOvertime(holidayMap, item.businessDate, item.kind) || undefined,
        });
        shiftMap[item.businessDate] = list;
      }
      const todaySummary = schedules.find((s) => s.businessDate === today) ?? null;
      const changeDates = Array.from(
        new Set(changes.map((c) => c.businessDate).filter((d): d is string => Boolean(d))),
      );
      const windowData: CalendarWindowData = {
        shiftMap,
        legend: templates,
        todaySummary,
        todayLabel: `${today} ${weekdayCN(today)}`,
        todayTimeText: todaySummary
          ? formatTimeRange(todaySummary.shiftSnapshot) ?? "休息"
          : "",
        todayLocation: todaySummary?.locationSnapshot?.name ?? "",
        todayDuration: todaySummary
          ? durationLabel(todaySummary.shiftSnapshot)
          : "",
        changeDates,
      };
      setCalendarWindow(this.data.year, this.data.month, windowData);
      this.applyWindow(windowData);
      this.setData({
        loading: false,
      });
    } catch (err) {
      if (!cached) {
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

  applyWindow(data: CalendarWindowData) {
    const changeSet = new Set(data.changeDates);
    const cells = this.data.cells.map((cell) => ({
      ...cell,
      hasChange: changeSet.has(cell.date),
    }));
    this.setData({
      shiftMap: data.shiftMap,
      legend: data.legend,
      todaySummary: data.todaySummary,
      todayLabel: data.todayLabel,
      todayTimeText: data.todayTimeText,
      todayLocation: data.todayLocation,
      todayDuration: data.todayDuration,
      changeDates: data.changeDates,
      cells,
    });
  },

  changeMonth(delta: number) {
    let year = this.data.year;
    let month = this.data.month + delta;
    if (month < 1) {
      month = 12;
      year -= 1;
    } else if (month > 12) {
      month = 1;
      year += 1;
    }
    const today = todayString();
    this.setData({
      year,
      month,
      monthLabel: monthLabel(year, month),
      cells: buildMonthGrid(year, month, today),
    });
    this.load();
  },

  prevMonth() {
    this.changeMonth(-1);
  },

  nextMonth() {
    this.changeMonth(1);
  },

  goToday() {
    this.initMonth();
    this.load();
  },

  goSchedules() {
    wx.navigateTo({ url: "/pages/schedules/index" });
  },

  onTouchStart(event: WechatMiniprogram.TouchEvent) {
    this.setData({ touchStartX: event.touches[0]?.clientX ?? 0 });
  },

  onTouchEnd(event: WechatMiniprogram.TouchEvent) {
    const endX = event.changedTouches[0]?.clientX ?? 0;
    const delta = endX - this.data.touchStartX;
    if (delta > 50) this.prevMonth();
    else if (delta < -50) this.nextMonth();
  },

  onDateTap(event: WechatMiniprogram.CustomEvent<{ date: string }>) {
    const date = event.detail.date;
    this.setData({ selectedDate: date });
    wx.navigateTo({ url: `/pages/schedule-detail/index?date=${date}` });
  },

  onDateLongPress(event: WechatMiniprogram.CustomEvent<{ date: string }>) {
    const date = event.detail.date;
    wx.navigateTo({ url: `/pages/schedule-change/index?date=${date}` });
  },

  addTodaySchedule() {
    wx.navigateTo({ url: `/pages/schedule-change/index?date=${todayString()}` });
  },

  changeToday() {
    if (!this.data.todaySummary) return;
    wx.navigateTo({ url: `/pages/schedule-change/index?id=${this.data.todaySummary.id}` });
  },

  shareToday() {
    wx.navigateTo({ url: `/pages/share/index?date=${todayString()}` });
  },
});
