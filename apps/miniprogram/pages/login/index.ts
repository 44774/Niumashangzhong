import { api, loginLocal } from "../../services/api";
import { USE_CLOUDBASE } from "../../config";
import { setSession } from "../../stores/session";

function wxLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => resolve(res.code),
      fail: () => reject(new Error("微信登录失败，请重试")),
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

  onLocalLogin() {
    if (this.data.loading) return;
    const doLogin = async () => {
      this.setData({ loading: true });
      try {
        if (USE_CLOUDBASE) {
          const result = await loginLocal(this.data.displayName.trim() || "本地用户");
          setSession(result.accessToken, result.user, result.workspace);
        } else {
          const result = await api.loginDev(this.data.displayName.trim() || "开发用户");
          setSession(result.accessToken, result.user, result.workspace, "http");
        }
        wx.switchTab({ url: "/pages/calendar/index" });
      } catch (err) {
        wx.showToast({ title: (err as Error).message, icon: "none" });
      } finally {
        this.setData({ loading: false });
      }
    };
    if (USE_CLOUDBASE) {
      wx.showModal({
        title: "本地登录",
        content:
          "本地登录后，你的班表数据仅保存在当前设备本地，不会上传云端；清除小程序数据或更换设备后将无法找回。是否继续？",
        confirmText: "确认登录",
        cancelText: "取消",
        success: (res) => {
          if (res.confirm) void doLogin();
        },
      });
    } else {
      void doLogin();
    }
  },
});
