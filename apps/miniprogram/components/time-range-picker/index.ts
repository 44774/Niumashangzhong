Component({
  properties: {
    startTime: { type: String, value: "" },
    endTime: { type: String, value: "" },
    endsNextDay: { type: Boolean, value: false },
  },

  methods: {
    onStartChange(event: WechatMiniprogram.PickerChange) {
      this.triggerEvent("change", { field: "startTime", value: event.detail.value });
    },
    onEndChange(event: WechatMiniprogram.PickerChange) {
      this.triggerEvent("change", { field: "endTime", value: event.detail.value });
    },
    onNextDayChange(event: WechatMiniprogram.SwitchChange) {
      this.triggerEvent("change", { field: "endsNextDay", value: Boolean(event.detail.value) });
    },
  },
});
