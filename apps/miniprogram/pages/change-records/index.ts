import { api } from "../../services/api";
import { getToken } from "../../stores/session";
import type { ChangeRequest } from "../../typings/api";
import { monthRange, parseDate, todayString } from "../../utils/date";
import { clearCalendarCache } from "../../services/calendar-cache";

const STATUS_TEXT: Record<string, string> = {
  approved: "已生效",
  pending: "待审批",
  rejected: "已驳回",
  withdrawn: "已撤回",
  expired: "已过期",
};

const pad = (n: number) => String(n).padStart(2, "0");

Page({
  data: {
    month: "",
    records: [] as Array<ChangeRequest & { statusText: string; createdAtText: string }>,
    page: 1,
    hasMore: false,
    loading: true,
    error: false,
    errorMessage: "",
  },

  onShow() {
    if (!getToken()) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    const today = todayString();
    const { year, month } = parseDate(today);
    this.setData({ month: `${year}-${pad(month)}` });
    this.load(true);
  },

  async load(reset: boolean) {
    const [year, month] = this.data.month.split("-").map(Number);
    const { start, end } = monthRange(year ?? new Date().getFullYear(), month ?? 1);
    const page = reset ? 1 : this.data.page;
    this.setData({
      loading: reset ? this.data.records.length === 0 : false,
      error: false,
      page,
    });
    try {
      const list = await api.changeRequestsInRange(start, end, page);
      const records = list.map((item) => {
        const d = new Date(item.createdAt);
        return {
          ...item,
          statusText: STATUS_TEXT[item.status] ?? item.status,
          createdAtText: `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
        };
      });
      this.setData({
        records: reset ? records : [...this.data.records, ...records],
        hasMore: records.length === 50,
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

  changeMonth(event: WechatMiniprogram.TouchEvent) {
    const delta = Number(event.currentTarget.dataset.delta);
    const [year, month] = this.data.month.split("-").map(Number);
    let y = year ?? new Date().getFullYear();
    let m = (month ?? 1) + delta;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    this.setData({ month: `${y}-${pad(m)}` });
    this.load(true);
  },

  loadMore() {
    this.setData({ page: this.data.page + 1 });
    this.load(false);
  },

  removeRecord(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string;
    wx.showModal({
      title: "删除改班记录",
      content: "删除后该条临时改班记录将从记录列表中移除（排班本身不受影响）。确定删除吗？",
      confirmText: "删除",
      confirmColor: "#EF4444",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.removeChangeRequest(id);
          clearCalendarCache();
          wx.showToast({ title: "已删除", icon: "success" });
          this.load(true);
        } catch (err) {
          wx.showToast({ title: (err as Error).message, icon: "none" });
        }
      },
    });
  },
});
