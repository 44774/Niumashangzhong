import { api, loginLocal } from "../../services/api";
import { USE_CLOUDBASE } from "../../config";
import { setSession } from "../../stores/session";
import { APP_NAME } from "../../utils/version";
import { hasAgreedPrivacyAgreement } from "../../utils/privacy-agreement";

interface WechatProfile {
  nickName: string;
  avatarUrl: string;
}

function wxLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => resolve(res.code),
      fail: () => reject(new Error("微信登录失败，请重试")),
    });
  });
}

function fetchWechatProfile(): Promise<WechatProfile | null> {
  return new Promise((resolve) => {
    wx.getUserProfile({
      desc: "用于完善个人资料",
      success: (res) => {
        const info = res.userInfo;
        resolve(
          info
            ? { nickName: info.nickName || "", avatarUrl: info.avatarUrl || "" }
            : null,
        );
      },
      fail: () => resolve(null),
    });
  });
}

Page({
  data: {
    displayName: "",
    loading: false,
    appName: APP_NAME,
  },

  onInput(event: WechatMiniprogram.Input) {
    this.setData({ displayName: event.detail.value });
  },

  async onWechatLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      // 先取微信资料（需紧跟用户点击手势），再获取登录 code
      let name = this.data.displayName.trim() || undefined;
      let avatarUrl: string | null | undefined;
      if (!name) {
        // 未输入自定义昵称时，自动获取微信昵称与头像
        const profile = await fetchWechatProfile();
        if (profile) {
          name = profile.nickName.trim() || undefined;
          avatarUrl = profile.avatarUrl || null;
        }
      }
      let code = "";
      try {
        code = await wxLoginCode();
      } catch {
        code = "";
      }
      const result = code
        ? await api.loginWechat(code, name, avatarUrl)
        : await api.loginDev(name ?? "微信用户", avatarUrl);
      setSession(result.accessToken, result.user, result.workspace);
      if (!hasAgreedPrivacyAgreement()) {
        wx.reLaunch({ url: "/pages/privacy-agreement/index" });
        return;
      }
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
        if (!hasAgreedPrivacyAgreement()) {
          wx.reLaunch({ url: "/pages/privacy-agreement/index" });
          return;
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
