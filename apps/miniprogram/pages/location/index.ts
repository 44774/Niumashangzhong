import { api } from "../../services/api";
import { getToken } from "../../stores/session";
import { getDefaultLocation, setDefaultLocation } from "../../stores/location";
import type { WeatherLocation } from "../../typings/api";

Page({
  data: {
    location: null as WeatherLocation | null,
    locationCoord: "",
    saving: false,
  },

  onShow() {
    if (!getToken()) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    const location = getDefaultLocation();
    this.setData({ location, locationCoord: coordText(location) });
  },

  async save(raw: WeatherLocation) {
    const location: WeatherLocation = {
      name: raw.name || "当前位置",
      latitude: Number(raw.latitude),
      longitude: Number(raw.longitude),
    };
    if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
      wx.showToast({ title: "定位数据异常，请重试", icon: "none" });
      return;
    }
    this.setData({ saving: true });
    try {
      setDefaultLocation(location);
      await api.updateLocation(location);
      this.setData({ location, locationCoord: coordText(location) });
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

function coordText(location: WeatherLocation | null): string {
  if (!location) return "";
  const lat = Number(location.latitude);
  const lng = Number(location.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
