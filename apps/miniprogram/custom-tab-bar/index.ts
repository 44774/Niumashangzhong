interface TabItem {
  pagePath: string;
  text: string;
}

Component({
  data: {
    selected: 0,
    list: [
      { pagePath: "/pages/calendar/index", text: "日历" },
      { pagePath: "/pages/week/index", text: "周视图" },
      { pagePath: "/pages/notify/index", text: "提醒" },
      { pagePath: "/pages/me/index", text: "我的" },
    ] as TabItem[],
  },

  lifetimes: {
    attached() {
      this.updateSelected();
    },
  },

  pageLifetimes: {
    show() {
      this.updateSelected();
    },
  },

  methods: {
    updateSelected() {
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      const route = current ? `/${current.route}` : "";
      const list = this.data.list as TabItem[];
      const index = Math.max(
        0,
        list.findIndex((item) => item.pagePath === route),
      );
      this.setData({ selected: index });
    },

    switchTab(event: WechatMiniprogram.TouchEvent) {
      const path = event.currentTarget.dataset.path as string;
      wx.switchTab({ url: path });
    },
  },
});
