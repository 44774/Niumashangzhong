Component({
  properties: {
    weather: { type: Object, value: {} },
    loading: { type: Boolean, value: false },
    error: { type: Boolean, value: false },
  },

  data: {
    updatedTime: "",
  },

  observers: {
    "weather.updatedAt"(updatedAt: string) {
      if (!updatedAt) {
        this.setData({ updatedTime: "" });
        return;
      }
      const d = new Date(updatedAt);
      const pad = (n: number) => String(n).padStart(2, "0");
      this.setData({
        updatedTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      });
    },
  },
});
