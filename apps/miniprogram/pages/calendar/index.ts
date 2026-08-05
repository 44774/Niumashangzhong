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
  todayString,
  weekdayCN,
} from "../../utils/date";
import { durationLabel, formatTimeRange } from "../../utils/format";
import { ensureHolidayRange } from "../../services/holiday-cache";
import { isOvertime } from "../../utils/holiday";
import { loadRange } from "../../services/schedule-view";
import {
  clearCalendarCache,
  getCalendarWindow,
  setCalendarWindow,
  type CalendarWindowData,
} from "../../services/calendar-cache";
import { getActiveRuleCache, getTemplatesCached } from "../../services/meta-cache";
import { getWeatherCached } from "../../services/weather-cache";
import type { WeatherForecast } from "../../typings/api";
import { hasAgreedPrivacyAgreement } from "../../utils/privacy-agreement";

interface MonthCell {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  hasShift: boolean;
  hasChange: boolean;
}

interface MonthVM {
  key: string;
  year: number;
  month: number;
  label: string;
  cells: MonthCell[];
  shiftMap: Record<string, CalendarDayShift[]>;
  legend: ShiftTemplate[];
  schedules: ScheduleInstance[];
  loading: boolean;
  loaded: boolean;
  error: boolean;
}

const PRELOAD_MONTHS = 3;
const MAX_MONTHS = 25;

let lastScheduledRuleKey = "";
let lastScrollTop = 0;
let correctionUntil = 0;
let snappingUntil = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const loadingMonths = new Map<string, Promise<void>>();

function monthStart(year: number, month: number): string {
  return `${year}-${pad2(month)}-01`;
}

function monthEnd(year: number, month: number): string {
  const days = new Date(year, month, 0).getDate();
  return `${year}-${pad2(month)}-${pad2(days)}`;
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function keyOf(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

Page({
  data: {
    year: 0,
    month: 0,
    monthLabel: "",
    monthValue: "",
    months: [] as MonthVM[],
    scrollTop: 0,
    monthHeight: 0,
    legend: [] as ShiftTemplate[],
    legendLoading: true,
    legendSk: [0, 1, 2, 3],
    selectedDate: "",
    selectedSummary: null as ScheduleInstance | null,
    selectedLabel: "",
    selectedTitle: "",
    selectedTimeText: "",
    selectedLocation: "",
    selectedDuration: "",
    todayWeather: null as WeatherForecast | null,
    weatherLoading: true,
    weatherError: false,
    showBackToday: false,
    error: false,
    errorMessage: "",
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
    if (this.data.months.length === 0) {
      this.initCalendar();
    }
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
    clearCalendarCache();
    const months = this.data.months.map((vm) => ({
      ...vm,
      loaded: false,
      loading: true,
      error: false,
    }));
    this.setData({ months });
    for (const vm of months) {
      void this.loadMonth(vm);
    }
    wx.stopPullDownRefresh();
  },

  initCalendar() {
    const today = todayString();
    const { year, month } = parseDate(today);
    const months: MonthVM[] = [];
    for (let delta = -PRELOAD_MONTHS; delta <= PRELOAD_MONTHS; delta += 1) {
      const ym = addMonths(year, month, delta);
      months.push(this.createMonthVM(ym.year, ym.month));
    }
    this.setData({
      year,
      month,
      monthLabel: monthLabel(year, month),
      monthValue: keyOf(year, month),
      months,
      selectedDate: today,
      showBackToday: false,
      error: false,
      legend: months[PRELOAD_MONTHS]?.legend ?? [],
      legendLoading: Boolean(months[PRELOAD_MONTHS]?.loading),
    });
    wx.nextTick(() => {
      this.measureMonthHeight();
    });
    for (const vm of months) {
      void this.loadMonth(vm);
    }
    this.loadWeatherFor(today);
    this.updateSelectedSummary();
  },

  createMonthVM(year: number, month: number): MonthVM {
    const cache = getCalendarWindow(year, month);
    const changeSet = new Set(cache?.changeDates ?? []);
    return {
      key: keyOf(year, month),
      year,
      month,
      label: monthLabel(year, month),
      cells: buildMonthGrid(year, month, todayString()).map((cell) => ({
        ...cell,
        hasShift: Boolean((cache?.shiftMap[cell.date] ?? []).length),
        hasChange: changeSet.has(cell.date),
      })),
      shiftMap: cache?.shiftMap ?? {},
      legend: cache?.legend ?? [],
      schedules: cache?.scheduleList ?? [],
      loading: !cache,
      loaded: Boolean(cache),
      error: false,
    };
  },

  patchMonth(key: string, patch: Partial<MonthVM>) {
    const months = this.data.months.map((vm) => (vm.key === key ? { ...vm, ...patch } : vm));
    this.setData({ months });
  },

  async loadMonth(vm: MonthVM) {
    if (vm.loaded || loadingMonths.has(vm.key)) return;
    const cache = getCalendarWindow(vm.year, vm.month);
    if (cache) {
      this.applyMonthData(vm, cache);
      return;
    }
    const promise = this.fetchMonth(vm);
    loadingMonths.set(vm.key, promise);
    try {
      await promise;
    } finally {
      loadingMonths.delete(vm.key);
    }
  },

  async fetchMonth(vm: MonthVM) {
    this.patchMonth(vm.key, { loading: true, error: false });
    const from = monthStart(vm.year, vm.month);
    const to = monthEnd(vm.year, vm.month);
    try {
      const [schedules, templates, holidayMap, changes] = await Promise.all([
        loadRange(from, to),
        getTemplatesCached().catch(() => []),
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
      const changeDates = Array.from(
        new Set(changes.map((c) => c.businessDate).filter((d): d is string => Boolean(d))),
      );
      const windowData: CalendarWindowData = {
        shiftMap,
        legend: templates,
        todaySummary: null,
        todayLabel: "",
        todayTimeText: "",
        todayLocation: "",
        todayDuration: "",
        changeDates,
        scheduleList: schedules,
      };
      setCalendarWindow(vm.year, vm.month, windowData);
      this.applyMonthData(vm, windowData);
      this.maybeScheduleRuleJobs();
      if (this.data.selectedDate >= from && this.data.selectedDate <= to) {
        this.updateSelectedSummary();
      }
    } catch (err) {
      this.patchMonth(vm.key, { loading: false, error: true });
      this.setData({ error: true, errorMessage: (err as Error).message });
    }
  },

  applyMonthData(vm: MonthVM, data: CalendarWindowData) {
    const changeSet = new Set(data.changeDates);
    const cells = buildMonthGrid(vm.year, vm.month, todayString()).map((cell) => ({
      ...cell,
      hasShift: Boolean((data.shiftMap[cell.date] ?? []).length),
      hasChange: changeSet.has(cell.date),
    }));
    this.patchMonth(vm.key, {
      cells,
      shiftMap: data.shiftMap,
      legend: data.legend,
      schedules: data.scheduleList,
      loading: false,
      loaded: true,
      error: false,
    });
    this.updateAnchorLegend();
  },

  updateAnchorLegend() {
    const months = this.data.months;
    const top =
      months.find((m) => m.key === keyOf(this.data.year, this.data.month)) ?? months[0];
    const legend =
      top?.legend && top.legend.length > 0
        ? top.legend
        : (months.find((m) => m.legend.length > 0)?.legend ?? []);
    this.setData({
      legend,
      legendLoading: Boolean(top?.loading) && legend.length === 0,
    });
  },

  maybeScheduleRuleJobs() {
    const activeRule = getActiveRuleCache();
    const activeKey = activeRule ? `${activeRule.id}:${activeRule.version}` : "";
    if (activeKey && activeKey !== lastScheduledRuleKey) {
      lastScheduledRuleKey = activeKey;
      void api.scheduleRuleJobs().catch(() => {
        // 提醒任务生成失败不影响排班展示
      });
    }
  },

  ensureWindow(year: number, month: number, opts: { jumpTo?: string } = {}) {
    if (opts.jumpTo) {
      const [jy, jm] = opts.jumpTo.split("-").map(Number);
      if (jy && jm) {
        this.setData({
          year: jy,
          month: jm,
          monthLabel: monthLabel(jy, jm),
          monthValue: opts.jumpTo,
        });
        this.updateShowBackToday();
      }
    }
    const required: Array<{ year: number; month: number; key: string }> = [];
    for (let delta = -PRELOAD_MONTHS; delta <= PRELOAD_MONTHS; delta += 1) {
      const ym = addMonths(year, month, delta);
      required.push({ ...ym, key: keyOf(ym.year, ym.month) });
    }
    const existing = new Set(this.data.months.map((vm) => vm.key));
    const missing = required.filter((r) => !existing.has(r.key));
    const prevFirstKey = this.data.months[0]?.key ?? "";
    if (missing.length === 0) {
      if (opts.jumpTo) {
        const index = this.data.months.findIndex((vm) => vm.key === opts.jumpTo);
        if (index >= 0 && this.data.monthHeight > 0) {
          correctionUntil = Date.now() + 300;
          this.setData({ scrollTop: index * this.data.monthHeight });
        }
      }
      return;
    }
    const months = [...this.data.months];
    const newVMs: MonthVM[] = [];
    let prependCount = 0;
    for (const r of missing) {
      const vm = this.createMonthVM(r.year, r.month);
      newVMs.push(vm);
      if (r.key < prevFirstKey) prependCount += 1;
      const index = months.findIndex((x) => x.key > r.key);
      if (index < 0) months.push(vm);
      else months.splice(index, 0, vm);
    }
    // 裁剪过远月份，保持 DOM 数量可控
    const centerKey = opts.jumpTo ?? keyOf(year, month);
    const centerIndex = months.findIndex((x) => x.key === centerKey);
    let pruneFront = 0;
    if (months.length > MAX_MONTHS && centerIndex >= 0) {
      const start = Math.max(0, centerIndex - 12);
      const end = Math.min(months.length, centerIndex + 13);
      if (end < months.length) months.splice(end);
      if (start > 0) {
        months.splice(0, start);
        pruneFront = start;
      }
    }
    const height = this.data.monthHeight;
    if (opts.jumpTo) {
      const index = months.findIndex((vm) => vm.key === opts.jumpTo);
      correctionUntil = Date.now() + 300;
      this.setData({
        months,
        scrollTop: (index >= 0 ? index : 0) * height,
        error: false,
      });
    } else {
      const adjust = (prependCount - pruneFront) * height;
      if (adjust !== 0) {
        correctionUntil = Date.now() + 300;
        this.setData({ months, scrollTop: lastScrollTop + adjust, error: false });
      } else {
        this.setData({ months, error: false });
      }
    }
    for (const vm of newVMs) {
      void this.loadMonth(vm);
    }
  },

  /** 滚动中只预加载已渲染月份的数据，不修改 DOM 布局，避免滚动跳变 */
  preloadNearby(top: MonthVM) {
    for (let delta = -PRELOAD_MONTHS; delta <= PRELOAD_MONTHS; delta += 1) {
      const ym = addMonths(top.year, top.month, delta);
      const key = keyOf(ym.year, ym.month);
      const vm = this.data.months.find((m) => m.key === key);
      if (vm && !vm.loaded) {
        void this.loadMonth(vm);
      }
    }
  },

  measureMonthHeight() {
    wx.createSelectorQuery()
      .select(".month-block")
      .boundingClientRect((rect) => {
        if (rect && rect.height > 0) {
          const index = this.data.months.findIndex(
            (vm) => vm.key === keyOf(this.data.year, this.data.month),
          );
          this.setData({
            monthHeight: rect.height,
            scrollTop: Math.max(0, index) * rect.height,
          });
          correctionUntil = Date.now() + 300;
        }
      })
      .exec();
  },

  onScroll(event: WechatMiniprogram.ScrollViewScroll) {
    lastScrollTop = event.detail.scrollTop;
    // 滚动停止防抖：停止约 300ms 后自动回正到月份边界
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimer = null;
      this.snapToMonth();
    }, 300);
    // 定位修正生效期间忽略中间滚动事件，避免级联扩展
    if (Date.now() < correctionUntil) return;
    const height = this.data.monthHeight;
    if (!height || this.data.months.length === 0) return;
    const topIndex = Math.max(
      0,
      Math.min(this.data.months.length - 1, Math.floor(event.detail.scrollTop / height)),
    );
    const top = this.data.months[topIndex];
    if (!top) return;
    this.applyTopMonth(top);
    // 滚动中持续加载前后 3 个月的数据（不增删 DOM）
    this.preloadNearby(top);
  },

  applyTopMonth(top: MonthVM) {
    if (top.key !== keyOf(this.data.year, this.data.month)) {
      this.setData({
        year: top.year,
        month: top.month,
        monthLabel: top.label,
        monthValue: top.key,
      });
      this.updateShowBackToday();
      this.updateAnchorLegend();
    }
  },

  /** 滚动停止后自动回正：吸附到最近的月份边界 */
  onScrollEnd() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    this.snapToMonth();
  },

  snapToMonth() {
    if (Date.now() < snappingUntil || Date.now() < correctionUntil) return;
    const height = this.data.monthHeight;
    if (!height || this.data.months.length === 0) return;
    const index = Math.max(
      0,
      Math.min(this.data.months.length - 1, Math.round(lastScrollTop / height)),
    );
    const target = index * height;
    if (Math.abs(lastScrollTop - target) > 2) {
      snappingUntil = Date.now() + 400;
      lastScrollTop = target;
      this.setData({ scrollTop: target });
      const month = this.data.months[index];
      if (month) this.applyTopMonth(month);
    }
  },

  onScrollToUpper() {
    if (Date.now() < correctionUntil) return;
    const first = this.data.months[0];
    if (first) this.ensureWindow(first.year, first.month);
  },

  onScrollToLower() {
    if (Date.now() < correctionUntil) return;
    const last = this.data.months[this.data.months.length - 1];
    if (last) this.ensureWindow(last.year, last.month);
  },

  changeMonth(delta: number) {
    const target = addMonths(this.data.year, this.data.month, delta);
    this.setData({
      year: target.year,
      month: target.month,
      monthLabel: monthLabel(target.year, target.month),
      monthValue: keyOf(target.year, target.month),
    });
    this.ensureWindow(target.year, target.month, { jumpTo: keyOf(target.year, target.month) });
    this.updateShowBackToday();
  },

  onMonthPickerChange(event: WechatMiniprogram.PickerChange) {
    const value = String(event.detail.value);
    const [y, m] = value.split("-").map(Number);
    if (!y || !m || m < 1 || m > 12) return;
    this.setData({
      year: y,
      month: m,
      monthLabel: monthLabel(y, m),
      monthValue: keyOf(y, m),
    });
    this.ensureWindow(y, m, { jumpTo: keyOf(y, m) });
    this.updateShowBackToday();
  },

  prevMonth() {
    this.changeMonth(-1);
  },

  nextMonth() {
    this.changeMonth(1);
  },

  goToday() {
    const today = todayString();
    const { year, month } = parseDate(today);
    this.setData({ selectedDate: today });
    this.ensureWindow(year, month, { jumpTo: keyOf(year, month) });
    this.updateSelectedSummary();
    this.loadWeatherFor(today);
  },

  goSchedules() {
    wx.navigateTo({ url: "/pages/schedules/index" });
  },

  updateShowBackToday() {
    const today = todayString();
    const { year: todayYear, month: todayMonth } = parseDate(today);
    this.setData({
      showBackToday:
        this.data.selectedDate !== today ||
        this.data.year !== todayYear ||
        this.data.month !== todayMonth,
    });
  },

  updateSelectedSummary() {
    const date = this.data.selectedDate;
    const today = todayString();
    const { year: todayYear, month: todayMonth } = parseDate(today);
    const month = this.data.months.find(
      (vm) => date >= monthStart(vm.year, vm.month) && date <= monthEnd(vm.year, vm.month),
    );
    const summary = month?.schedules.find((s) => s.businessDate === date) ?? null;
    this.setData({
      selectedSummary: summary,
      selectedLabel: `${date} ${weekdayCN(date)}`,
      selectedTitle: date === today ? "今日排班" : "所选日期排班",
      selectedTimeText: summary ? formatTimeRange(summary.shiftSnapshot) ?? "休息" : "",
      selectedLocation: summary?.locationSnapshot?.name ?? "",
      selectedDuration: summary ? durationLabel(summary.shiftSnapshot) : "",
      showBackToday:
        date !== today || this.data.year !== todayYear || this.data.month !== todayMonth,
    });
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
