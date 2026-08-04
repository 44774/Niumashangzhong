import { api } from "../../services/api";
import { CLOUD_ENV_ID, USE_CLOUDBASE } from "../../config";
import { setSession } from "../../stores/session";

let cloudInitialized = false;

function wxLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => resolve(res.code),
      fail: () => reject(new Error("微信登录失败，请使用开发账号登录")),
    });
  });
}

Page({
  data: {
    displayName: "",
    loading: false,
  },

  onInput(event: WechatMiniprogram.Input) {
    this.setData({ displayName: event.detail.value });
  },

  onShow() {
    if (USE_CLOUDBASE) {
      this.cloudAutoLogin();
    }
  },

  async cloudAutoLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      if (!cloudInitialized) {
        wx.cloud.init({ env: CLOUD_ENV_ID, traceUser: true });
        cloudInitialized = true;
      }
      const result = await api.loginDev("");
      setSession(result.accessToken, result.user, result.workspace);
      wx.switchTab({ url: "/pages/calendar/index" });
    } catch (err) {
      wx.showToast({
        title: `云开发连接失败：${(err as Error).message}`,
        icon: "none",
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async onWechatLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      let code = "";
      try {
        code = await wxLoginCode();
      } catch {
        code = "";
      }
      const name = this.data.displayName.trim() || undefined;
      const result = code
        ? await api.loginWechat(code, name)
        : await api.loginDev(name ?? "微信用户");
      setSession(result.accessToken, result.user, result.workspace);
      wx.switchTab({ url: "/pages/calendar/index" });
    } catch (err) {
      wx.showToast({ title: (err as Error).message, icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  async onDevLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const result = await api.loginDev(this.data.displayName.trim() || "开发用户");
      setSession(result.accessToken, result.user, result.workspace);
      wx.switchTab({ url: "/pages/calendar/index" });
    } catch (err) {
      wx.showToast({ title: (err as Error).message, icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },
});
