import type { SharePrivacyOptions } from "../../typings/api";

const PRIVACY_KEY = "wc_share_privacy";

Page({
  data: {
    items: [
      { key: "showDisplayName", label: "显示昵称" },
      { key: "showTime", label: "显示上下班时间" },
      { key: "showWeather", label: "显示天气" },
      { key: "showLocation", label: "显示地点" },
      { key: "showNote", label: "显示备注" },
    ],
    privacy: {
      showDisplayName: true,
      showTime: true,
      showWeather: true,
      showLocation: false,
      showNote: false,
    } as SharePrivacyOptions,
  },

  onShow() {
    this.setData({ privacy: readStoredPrivacy() });
  },

  onChange(event: WechatMiniprogram.SwitchChange) {
    const key = event.currentTarget.dataset.key as keyof SharePrivacyOptions;
    this.setData({ privacy: { ...this.data.privacy, [key]: Boolean(event.detail.value) } });
  },

  save() {
    wx.setStorageSync(PRIVACY_KEY, this.data.privacy);
    wx.showToast({ title: "已保存", icon: "success" });
  },
});

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
