export interface CalendarDayShift {
  name: string;
  shortName: string;
  color: string;
  overtime?: boolean;
}

Component({
  properties: {
    cells: { type: Array, value: [] },
    selectedDate: { type: String, value: "" },
    shiftMap: { type: Object, value: {} },
    legend: { type: Array, value: [] },
  },

  methods: {
    onTap(event: WechatMiniprogram.TouchEvent) {
      this.triggerEvent("datetap", { date: event.currentTarget.dataset.date as string });
    },
    onLongPress(event: WechatMiniprogram.TouchEvent) {
      this.triggerEvent("datelongpress", { date: event.currentTarget.dataset.date as string });
    },
  },
});
