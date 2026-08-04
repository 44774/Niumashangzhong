import { api } from "../../services/api";
import { getToken } from "../../stores/session";
import type { SharePrivacyOptions, ShareSnapshot, WeatherForecast } from "../../typings/api";
import {
  addDays,
  parseDate,
  todayString,
  weekdayCN,
} from "../../utils/date";
import { buildPreviewEntries } from "../../utils/poster-data";
import {
  buildCalendarGrid,
  calendarPosterHeight,
  drawCalendarPoster,
  drawPoster,
  posterHeight,
  type CalendarGridCell,
} from "../../utils/poster";
import { isMultiDay, needsLongRangeWarning } from "../../utils/share-range";
import { ensureHolidayRange } from "../../services/holiday-cache";
import { isOvertime } from "../../utils/holiday";

const PRIVACY_KEY = "wc_share_privacy";

interface PrivacyItem {
  key: keyof SharePrivacyOptions;
  label: string;
}

const PRIVACY_ITEMS: PrivacyItem[] = [
  { key: "showDisplayName", label: "显示昵称" },
  { key: "showTime", label: "显示上下班时间" },
  { key: "showWeather", label: "显示天气" },
  { key: "showLocation", label: "显示地点" },
  { key: "showNote", label: "显示备注" },
];

function defaultPrivacy(): SharePrivacyOptions {
  return readStoredPrivacy();
}

function readStoredPrivacy(): SharePrivacyOptions {
  const saved = wx.getStorageSync(PRIVACY_KEY) as Partial<SharePrivacyOptions> | null;
  return {
    showDisplayName: saved?.showDisplayName ?? true,
    showTime: saved?.showTime ?? true,
    showWeather: saved?.showWeather ?? true,
    showLocation: saved?.showLocation ?? false,
    showNote: saved?.showNote ?? false,
  };
}

Page({
  data: {
    rangeIndex: 0,
    rangeOptions: [] as Array<{ label: string; start: string; end: string }>,
    rangeStart: "",
    rangeEnd: "",
    privacyItems: PRIVACY_ITEMS,
    privacy: defaultPrivacy(),
    previewEntries: [] as ReturnType<typeof buildPreviewEntries>,
    previewGrid: [] as CalendarGridCell[],
    isMultiDay: false,
    customStart: "",
    customEnd: "",
    loading: true,
    error: false,
    errorMessage: "",
    generating: false,
    posterPath: "",
    canvasVisible: false,
    canvasHeight: 1200,
    snapshot: null as ShareSnapshot | null,
    weatherList: [] as WeatherForecast[],
  },

  onLoad(query: Record<string, string | undefined>) {
    const date = query.date ?? todayString();
    const month = thisMonthRangeFromDate(date);
    const options = [
      { label: "今日", start: date, end: date },
      { label: "本周", start: date, end: addDays(date, 6) },
      { label: "本月", start: month.start, end: month.end },
      { label: "自定义", start: date, end: date },
    ];
    this.setData({
      rangeOptions: options,
      rangeStart: options[0]?.start ?? date,
      rangeEnd: options[0]?.end ?? date,
      customStart: date,
      customEnd: date,
    });
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
      const { rangeStart, rangeEnd } = this.data;
      const [schedules, weatherList, holidayMap] = await Promise.all([
        api.schedules(rangeStart, rangeEnd),
        api.weather(rangeStart, rangeEnd),
        ensureHolidayRange(rangeStart, rangeEnd),
      ]);
      const previewEntries = buildPreviewEntries(schedules, weatherList, this.data.privacy).map(
        (entry) => {
          const overtime = isOvertime(holidayMap, entry.date, entry.kind) || undefined;
          return {
            ...entry,
            overtime,
            day: String(Number(entry.date.slice(8, 10))),
            weekday: weekdayCN(entry.date),
          };
        },
      );
      const multi = isMultiDay(rangeStart, rangeEnd);
      this.setData({
        weatherList,
        previewEntries,
        previewGrid: multi
          ? buildCalendarGrid(rangeStart, rangeEnd, previewEntries)
          : [],
        isMultiDay: multi,
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

  onRangeChange(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index);
    const option = this.data.rangeOptions[index];
    if (!option) return;
    if (index === 3) {
      this.setData({
        rangeIndex: index,
        rangeStart: this.data.customStart,
        rangeEnd: this.data.customEnd,
      });
    } else {
      this.setData({ rangeIndex: index, rangeStart: option.start, rangeEnd: option.end });
    }
    this.load();
  },

  onCustomStartChange(event: WechatMiniprogram.PickerChange) {
    const customStart = String(event.detail.value);
    this.setData({ customStart });
    if (this.data.rangeIndex === 3) {
      this.setData({ rangeStart: customStart });
      this.load();
    }
  },

  onCustomEndChange(event: WechatMiniprogram.PickerChange) {
    const customEnd = String(event.detail.value);
    this.setData({ customEnd });
    if (this.data.rangeIndex === 3) {
      this.setData({ rangeEnd: customEnd });
      this.load();
    }
  },

  onPrivacyChange(event: WechatMiniprogram.SwitchChange) {
    const key = event.currentTarget.dataset.key as keyof SharePrivacyOptions;
    const privacy = { ...this.data.privacy, [key]: Boolean(event.detail.value) };
    wx.setStorageSync(PRIVACY_KEY, privacy);
    this.setData({ privacy });
    this.refreshPreview();
  },

  refreshPreview() {
    // 简化处理：重新拉取当前范围数据以应用隐私过滤
    this.load();
  },

  async generate() {
    if (this.data.generating) return;
    if (needsLongRangeWarning(this.data.rangeStart, this.data.rangeEnd)) {
      wx.showModal({
        title: "日期跨度较长",
        content:
          "当前范围超过 3 个月，生成的海报会很长，可能影响保存效果。是否继续生成？",
        confirmText: "继续生成",
        cancelText: "取消",
        success: (res) => {
          if (res.confirm) void this.doGenerate();
        },
      });
      return;
    }
    void this.doGenerate();
  },

  async doGenerate() {
    if (this.data.generating) return;
    this.setData({ generating: true, canvasVisible: true });
    try {
      const snapshot = await api.createShareSnapshot({
        rangeStart: this.data.rangeStart,
        rangeEnd: this.data.rangeEnd,
        templateCode: "default",
        privacyOptions: this.data.privacy,
      });
      const multi = isMultiDay(this.data.rangeStart, this.data.rangeEnd);
      const height = multi
        ? calendarPosterHeight(snapshot.rangeStart, snapshot.rangeEnd)
        : posterHeight(snapshot);
      this.setData({
        snapshot,
        canvasHeight: Math.min(900, height * 0.6),
        generating: false,
      });
      const draw = multi ? drawCalendarPoster : drawPoster;
      draw(snapshot, (err, path) => {
        if (err) {
          wx.showToast({ title: err.message, icon: "none" });
          this.setData({ generating: false, canvasVisible: false });
          return;
        }
        this.setData({ posterPath: path ?? "", canvasVisible: false, generating: false });
      });
    } catch (err) {
      this.setData({ generating: false, canvasVisible: false });
      wx.showToast({ title: (err as Error).message, icon: "none" });
    }
  },

  saveImage() {
    if (!this.data.posterPath) return;
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterPath,
      success: () => wx.showToast({ title: "已保存到相册", icon: "success" }),
      fail: () => wx.showToast({ title: "保存失败，请检查相册权限", icon: "none" }),
    });
  },

  onShareAppMessage() {
    return {
      title: "我的班表（工作日历）",
      path: "/pages/calendar/index",
      imageUrl: this.data.posterPath || undefined,
    };
  },

  goCalendar() {
    wx.switchTab({ url: "/pages/calendar/index" });
  },
});

function thisMonthRangeFromDate(date: string): { start: string; end: string } {
  const { year, month } = parseDate(date);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = addDays(`${year}-${String(month + 1).padStart(2, "0")}-01`, -1);
  return { start, end };
}
