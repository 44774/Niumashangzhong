import { api } from "../../services/api";
import { getToken } from "../../stores/session";
import type { ChangeRequest } from "../../typings/api";

const STATUS_TEXT: Record<string, string> = {
  approved: "已生效",
  pending: "待审批",
  rejected: "已驳回",
  withdrawn: "已撤回",
  expired: "已过期",
};

Page({
  data: {
    records: [] as Array<ChangeRequest & { statusText: string; createdAtText: string }>,
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

  async load() {
    this.setData({ loading: true, error: false });
    try {
      const list = await api.changeRequests();
      const records = list.map((item) => {
        const d = new Date(item.createdAt);
        const pad = (n: number) => String(n).padStart(2, "0");
        return {
          ...item,
          statusText: STATUS_TEXT[item.status] ?? item.status,
          createdAtText: `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
        };
      });
      this.setData({ records, loading: false });
    } catch (err) {
      this.setData({
        loading: false,
        error: true,
        errorMessage: (err as Error).message,
      });
    }
  },
});
