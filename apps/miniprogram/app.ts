import { CLOUD_ENV_ID, USE_CLOUDBASE } from "./config";
import { getToken } from "./stores/session";

App({
  onLaunch() {
    if (USE_CLOUDBASE) {
      wx.cloud.init({ env: CLOUD_ENV_ID, traceUser: true });
    } else if (!getToken()) {
      wx.reLaunch({ url: "/pages/login/index" });
    }
  },
});
