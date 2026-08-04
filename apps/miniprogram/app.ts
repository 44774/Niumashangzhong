import { CLOUD_ENV_ID, USE_CLOUDBASE } from "./config";
import { api } from "./services/api";
import { getToken } from "./stores/session";

App({
  onLaunch() {
    if (USE_CLOUDBASE) {
      wx.cloud.init({ env: CLOUD_ENV_ID, traceUser: true });
      if (getToken()) {
        // 静默恢复会话：刷新用户信息，失败时保留本地缓存，不弹登录页
        void api.me().catch(() => {
          // 忽略刷新失败
        });
      }
    } else if (!getToken()) {
      wx.reLaunch({ url: "/pages/login/index" });
    }
  },
});
