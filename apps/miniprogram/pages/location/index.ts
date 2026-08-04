import { api } from "../../services/api";
import { getToken } from "../../stores/session";
import { getDefaultLocation, setDefaultLocation } from "../../stores/location";
import type { WeatherLocation } from "../../typings/api";

Page({
  data: {
    location: null as WeatherLocation | null,
    saving: false,
  },

  onShow() {
    if (!getToken()) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    this.setData({ location: getDefaultLocation() });
  },

  async save(location: WeatherLocation) {
    this.setData({ saving: true });
    try {
      setDefaultLocation(location);
      await api.updateLocation(location);
      this.setData({ location });
      wx.showToast({ title: "位置已保存", icon: "success" });
    } catch (err) {
      wx.showToast({ title: (err as Error).message, icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },

  onChooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        void this.save({
          name: res.name || res.address || "已选位置",
          latitude: res.latitude,
          longitude: res.longitude,
        });
      },
      fail: () => {
        wx.showModal({
          title: "无法打开地图",
          content: "请在设置中允许使用位置信息，或改用“使用当前位置”。",
          showCancel: false,
        });
      },
    });
  },

  onAutoLocation() {
    wx.getLocation({
      type: "gcj02",
      success: (res) => {
        void this.save({
          name: "当前位置",
          latitude: res.latitude,
          longitude: res.longitude,
        });
      },
      fail: () => {
        wx.showModal({
          title: "定位失败",
          content: "未获得定位权限。可在右上角「… → 设置」中允许位置信息后重试，或使用地图选点。",
          confirmText: "知道了",
          showCancel: false,
        });
      },
    });
  },
});
