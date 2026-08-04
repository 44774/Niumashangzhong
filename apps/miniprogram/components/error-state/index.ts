Component({
  properties: {
    message: { type: String, value: "加载失败" },
    retry: { type: Boolean, value: true },
  },

  methods: {
    onRetry() {
      this.triggerEvent("retry");
    },
  },
});
