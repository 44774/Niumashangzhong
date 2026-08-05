import { api } from "../../services/api";
import { clearSession, getToken, getUser, getWorkspace } from "../../stores/session";
import { APP_NAME, APP_VERSION } from "../../utils/version";

Page({
  data: {
    user: { displayName: "", id: "" },
    workspace: { name: "", id: "" },
    avatarText: "",
    appName: APP_NAME,
    version: APP_VERSION,
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
    wx.navigateTo({ url: "/pages/about/index" });
  },

  logout() {
    wx.showModal({
      title: "退出登录",
      content: "退出后需要重新登录；云模式数据仍在云端，本地模式数据仍保留在本机。",
      success: (res) => {
        if (!res.confirm) return;
        clearSession();
        wx.reLaunch({ url: "/pages/login/index" });
      },
    });
  },
});
