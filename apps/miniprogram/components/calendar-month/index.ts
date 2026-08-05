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
    loading: { type: Boolean, value: false },
  },

  data: {
    skItems: [0, 1, 2, 3],
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
