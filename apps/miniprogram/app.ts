import { getToken } from "./stores/session";

App({
  onLaunch() {
    if (!getToken()) {
      wx.reLaunch({ url: "/pages/login/index" });
    }
  },
});
