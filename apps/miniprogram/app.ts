import { CLOUD_ENV_ID, USE_CLOUDBASE } from "./config";
import { api } from "./services/api";
import { getToken } from "./stores/session";

App({
  onLaunch() {
    if (USE_CLOUDBASE) {
      wx.cloud.init({ env: CLOUD_ENV_ID, traceUser: true });
      // 云开发自动身份：静默建立用户与个人工作空间
      void api.me().catch(() => {
        // 网络或环境未配置时保持本地状态，页面会展示错误
      });
    } else if (!getToken()) {
      wx.reLaunch({ url: "/pages/login/index" });
    }
  },
});
