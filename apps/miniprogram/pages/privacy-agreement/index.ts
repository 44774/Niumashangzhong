import { clearSession } from "../../stores/session";
import { PRIVACY_ITEMS, PRIVACY_USAGE_RULE } from "../../utils/privacy";
import {
  PRIVACY_AGREEMENT_VERSION,
  hasAgreedPrivacyAgreement,
  markPrivacyAgreementAgreed,
} from "../../utils/privacy-agreement";
import { APP_NAME, APP_VERSION } from "../../utils/version";

Page({
  data: {
    appName: APP_NAME,
    appVersion: APP_VERSION,
    agreementVersion: `v${PRIVACY_AGREEMENT_VERSION}`,
    rule: PRIVACY_USAGE_RULE,
    items: PRIVACY_ITEMS,
    readonly: false,
    canAgree: false,
  },

  onLoad(query: Record<string, string | undefined>) {
    this.setData({ readonly: query.readonly === "1" });
  },

  onShow() {
    // 非只读模式：已同意当前版本则直接进入
    if (!this.data.readonly && hasAgreedPrivacyAgreement()) {
      wx.switchTab({ url: "/pages/calendar/index" });
    }
  },

  onScrollToBottom() {
    if (!this.data.canAgree) {
      this.setData({ canAgree: true });
    }
  },

  onAgree() {
    if (this.data.readonly) {
      this.onBack();
      return;
    }
    if (!this.data.canAgree) return;
    markPrivacyAgreementAgreed();
    wx.switchTab({ url: "/pages/calendar/index" });
  },

  onDisagree() {
    wx.showModal({
      title: "无法继续使用",
      content: `您需要同意《用户隐私协议》后才能使用${APP_NAME}。`,
      confirmText: "退出小程序",
      cancelText: "重新阅读",
      success: (res) => {
        if (!res.confirm) return;
        clearSession();
        wx.exitMiniProgram({
          fail: () => {
            wx.reLaunch({ url: "/pages/login/index" });
          },
        });
      },
    });
  },

  onBack() {
    wx.navigateBack({
      fail: () => {
        wx.reLaunch({ url: "/pages/calendar/index" });
      },
    });
  },
});
