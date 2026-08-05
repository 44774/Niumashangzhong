import { CLOUD_ENV_ID, USE_CLOUDBASE } from "./config";
import { api } from "./services/api";
import { registerPrivacyHandler } from "./services/privacy";
import { getToken } from "./stores/session";
import { hasAgreedPrivacyAgreement } from "./utils/privacy-agreement";

App({
  onLaunch() {
    registerPrivacyHandler();
    if (USE_CLOUDBASE) {
      wx.cloud.init({ env: CLOUD_ENV_ID, traceUser: true });
    }
    if (getToken()) {
      if (!hasAgreedPrivacyAgreement()) {
        // 未同意当前版本隐私协议：强制进入协议确认页
        wx.reLaunch({ url: "/pages/privacy-agreement/index" });
        return;
      }
      if (USE_CLOUDBASE) {
        // 静默恢复会话：刷新用户信息，失败时保留本地缓存，不弹登录页
        void api.me().catch(() => {
          // 忽略刷新失败
        });
      }
    } else if (!USE_CLOUDBASE) {
      wx.reLaunch({ url: "/pages/login/index" });
    }
  },
});
