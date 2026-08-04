Component({
  properties: {
    name: { type: String, value: "" },
    shortName: { type: String, value: "" },
    color: { type: String, value: "#1F6FEB" },
    size: { type: String, value: "md" },
  },

  data: {
    bgColor: "#1A1F6FEB",
  },

  observers: {
    color(color: string) {
      this.setData({ bgColor: `${color}1A` });
    },
  },
});
