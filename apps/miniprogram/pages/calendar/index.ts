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
  pad2,
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
import { getActiveRuleCache } from "../../services/meta-cache";
import { getWeatherCached } from "../../services/weather-cache";
import type { WeatherForecast } from "../../typings/api";
import { hasAgreedPrivacyAgreement } from "../../utils/privacy-agreement";

let lastScheduledRuleKey = "";

Page({
  data: {
    year: 0,
    month: 0,
    monthLabel: "",
    monthValue: "",
    cells: [] as Array<{ date: string; day: number; inMonth: boolean; isToday: boolean }>,
    selectedDate: "",
    shiftMap: {} as Record<string, CalendarDayShift[]>,
    legend: [] as ShiftTemplate[],
    todaySummary: null as ScheduleInstance | null,
    selectedSummary: null as ScheduleInstance | null,
    selectedLabel: "",
    selectedTitle: "",
    selectedTimeText: "",
    selectedLocation: "",
    selectedDuration: "",
    scheduleList: [] as ScheduleInstance[],
    changeDates: [] as string[],
    todayWeather: null as WeatherForecast | null,
    weatherLoading: true,
    weatherError: false,
    showBackToday: false,
    loading: true,
    error: false,
    errorMessage: "",
    touchStartX: 0,
    touchStartY: 0,
  },

  onShow() {
    this.setTabBarSelected(0);
    if (!getToken()) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    if (!hasAgreedPrivacyAgreement()) {
      wx.reLaunch({ url: "/pages/privacy-agreement/index" });
      return;
    }
    if (!this.data.year) {
      this.initMonth();
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
      monthValue: `${year}-${pad2(month)}`,
      cells: buildMonthGrid(year, month, today).map((cell) => ({ ...cell, hasShift: false })),
      selectedDate: today,
      showBackToday: false,
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
      const [templates, schedules, holidayMap, changes, todayWeatherList] = await Promise.all([
        api.shiftTemplates(true),
        loadRange(from, to),
        ensureHolidayRange(from, to),
        api.changeRequestsInRange(from, to).catch(() => []),
        getWeatherCached(this.data.selectedDate, this.data.selectedDate).catch(() => []),
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
      const selectedSummary = schedules.find((s) => s.businessDate === this.data.selectedDate) ?? null;
      const changeDates = Array.from(
        new Set(changes.map((c) => c.businessDate).filter((d): d is string => Boolean(d))),
      );
      const windowData: CalendarWindowData = {
        shiftMap,
        legend: templates,
        todaySummary: selectedSummary,
        todayLabel: `${this.data.selectedDate} ${weekdayCN(this.data.selectedDate)}`,
        todayTimeText: selectedSummary
          ? formatTimeRange(selectedSummary.shiftSnapshot) ?? "休息"
          : "",
        todayLocation: selectedSummary?.locationSnapshot?.name ?? "",
        todayDuration: selectedSummary ? durationLabel(selectedSummary.shiftSnapshot) : "",
        changeDates,
        scheduleList: schedules,
      };
      setCalendarWindow(this.data.year, this.data.month, windowData);
      this.applyWindow(windowData);
      // 当前排班表变化时，云端按规则预生成订阅消息提醒任务
      const activeRule = getActiveRuleCache();
      const activeKey = activeRule ? `${activeRule.id}:${activeRule.version}` : "";
      if (activeKey && activeKey !== lastScheduledRuleKey) {
        lastScheduledRuleKey = activeKey;
        void api.scheduleRuleJobs().catch(() => {
          // 提醒任务生成失败不影响排班展示
        });
      }
      this.setData({
        scheduleList: schedules,
        selectedSummary,
        selectedLabel: `${this.data.selectedDate} ${weekdayCN(this.data.selectedDate)}`,
        selectedTitle: this.data.selectedDate === today ? "今日排班" : "所选日期排班",
        selectedTimeText: selectedSummary
          ? formatTimeRange(selectedSummary.shiftSnapshot) ?? "休息"
          : "",
        selectedLocation: selectedSummary?.locationSnapshot?.name ?? "",
        selectedDuration: selectedSummary ? durationLabel(selectedSummary.shiftSnapshot) : "",
        todayWeather: todayWeatherList[0] ?? null,
        weatherLoading: false,
        weatherError: false,
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
        this.setData({ loading: false, weatherLoading: false, weatherError: true });
      }
    }
  },

  applyWindow(data: CalendarWindowData) {
    const changeSet = new Set(data.changeDates);
    const cells = this.data.cells.map((cell) => ({
      ...cell,
      hasChange: changeSet.has(cell.date),
      hasShift: Boolean((data.shiftMap[cell.date] ?? []).length),
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
      scheduleList: data.scheduleList,
    });
    this.updateSelectedSummary();
  },

  updateSelectedSummary() {
    const date = this.data.selectedDate;
    const summary = this.data.scheduleList.find((s) => s.businessDate === date) ?? null;
    const today = todayString();
    const { year: todayYear, month: todayMonth } = parseDate(today);
    this.setData({
      selectedSummary: summary,
      selectedLabel: `${date} ${weekdayCN(date)}`,
      selectedTitle: date === todayString() ? "今日排班" : "所选日期排班",
      selectedTimeText: summary ? formatTimeRange(summary.shiftSnapshot) ?? "休息" : "",
      selectedLocation: summary?.locationSnapshot?.name ?? "",
      selectedDuration: summary ? durationLabel(summary.shiftSnapshot) : "",
      showBackToday:
        date !== today || this.data.year !== todayYear || this.data.month !== todayMonth,
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
      monthValue: `${year}-${pad2(month)}`,
      cells: buildMonthGrid(year, month, today).map((cell) => ({ ...cell, hasShift: false })),
    });
    this.load();
  },

  onMonthPickerChange(event: WechatMiniprogram.PickerChange) {
    const value = String(event.detail.value);
    const [y, m] = value.split("-").map(Number);
    if (!y || !m || m < 1 || m > 12) return;
    const today = todayString();
    this.setData({
      year: y,
      month: m,
      monthLabel: monthLabel(y, m),
      monthValue: `${y}-${pad2(m)}`,
      cells: buildMonthGrid(y, m, today).map((cell) => ({ ...cell, hasShift: false })),
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
    const touch = event.touches[0];
    this.setData({
      touchStartX: touch?.clientX ?? 0,
      touchStartY: touch?.clientY ?? 0,
    });
  },

  onTouchEnd(event: WechatMiniprogram.TouchEvent) {
    const touch = event.changedTouches[0];
    const endX = touch?.clientX ?? 0;
    const endY = touch?.clientY ?? 0;
    const deltaX = endX - this.data.touchStartX;
    const deltaY = endY - this.data.touchStartY;
    // 纵向滑动优先：上滑切到下个月，下滑切回上个月
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 60) {
      if (deltaY < 0) this.nextMonth();
      else this.prevMonth();
      return;
    }
    if (deltaX > 50) this.prevMonth();
    else if (deltaX < -50) this.nextMonth();
  },

  onDateTap(event: WechatMiniprogram.CustomEvent<{ date: string }>) {
    const date = event.detail.date;
    if (this.data.selectedDate !== date) {
      // 第一次点击：仅选中
      this.setData({ selectedDate: date });
      this.updateSelectedSummary();
      this.loadWeatherFor(date);
      return;
    }
    // 第二次点击：进入详情
    wx.navigateTo({ url: `/pages/schedule-detail/index?date=${date}` });
  },

  loadWeatherFor(date: string) {
    void getWeatherCached(date, date)
      .then((list) => {
        this.setData({ todayWeather: list[0] ?? null, weatherError: false });
      })
      .catch(() => {
        this.setData({ weatherError: true });
      });
  },

  onDateLongPress(event: WechatMiniprogram.CustomEvent<{ date: string }>) {
    const date = event.detail.date;
    wx.navigateTo({ url: `/pages/schedule-change/index?date=${date}` });
  },

  addTodaySchedule() {
    wx.navigateTo({ url: `/pages/schedule-change/index?date=${this.data.selectedDate}` });
  },

  changeToday() {
    if (!this.data.selectedSummary) return;
    const summary = this.data.selectedSummary;
    const url = summary.id.startsWith("rule:")
      ? `/pages/schedule-change/index?date=${summary.businessDate}`
      : `/pages/schedule-change/index?id=${summary.id}`;
    wx.navigateTo({ url });
  },

  shareToday() {
    wx.navigateTo({ url: `/pages/share/index?date=${this.data.selectedDate}` });
  },
});
