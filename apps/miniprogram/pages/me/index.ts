import { api } from "../../services/api";
import { clearSession, getToken, getUser, getWorkspace } from "../../stores/session";

Page({
  data: {
    user: { displayName: "", id: "" },
    workspace: { name: "", id: "" },
    avatarText: "",
  },

  onShow() {
    this.setTabBarSelected(3);
    if (!getToken()) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    this.refresh();
  },

  setTabBarSelected(index: number) {
    const tabBar = this.getTabBar?.();
    if (tabBar) {
      (tabBar as unknown as { setData: (data: { selected: number }) => void }).setData({
        selected: index,
      });
    }
  },

  async refresh() {
    const user = getUser() ?? { displayName: "", id: "" };
    const workspace = getWorkspace() ?? { name: "", id: "" };
    this.setData({
      user,
      workspace,
      avatarText: user.displayName.slice(0, 1) || "工",
    });
    try {
      const me = await api.me();
      this.setData({ user: me, avatarText: me.displayName.slice(0, 1) || "工" });
    } catch {
      // 使用本地缓存继续展示
    }
  },

  goShiftManage() {
    wx.navigateTo({ url: "/pages/shift-manage/index" });
  },

  goChangeRecords() {
    wx.navigateTo({ url: "/pages/change-records/index" });
  },

  goShareSettings() {
    wx.navigateTo({ url: "/pages/share-settings/index" });
  },

  goNotify() {
    wx.switchTab({ url: "/pages/notify/index" });
  },

  goLocation() {
    wx.navigateTo({ url: "/pages/location/index" });
  },

  goSchedules() {
    wx.navigateTo({ url: "/pages/schedules/index" });
  },

  showAbout() {
    wx.showModal({
      title: "关于工作日历",
      content:
        "个人模式第一版：班次模板、月历/周视图、排班详情、临时改班、提醒设置与分享海报。分享默认不包含手机号、精确地址与内部备注。",
      showCancel: false,
    });
  },

  logout() {
    wx.showModal({
      title: "退出登录",
      content: "退出后本地数据将被清除，排班数据仍保存在服务器。",
      success: (res) => {
        if (!res.confirm) return;
        clearSession();
        wx.reLaunch({ url: "/pages/login/index" });
      },
    });
  },
});
