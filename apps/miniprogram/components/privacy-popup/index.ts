import { PRIVACY_ITEMS, PRIVACY_USAGE_RULE } from "../../utils/privacy";
import {
  resolvePrivacyAgree,
  resolvePrivacyDisagree,
  subscribePrivacyRequest,
} from "../../services/privacy";

let unsubscribe: (() => void) | null = null;

Component({
  data: {
    visible: false,
    rule: PRIVACY_USAGE_RULE,
    items: PRIVACY_ITEMS,
  },

  lifetimes: {
    attached() {
      unsubscribe = subscribePrivacyRequest(() => {
        this.setData({ visible: true });
      });
    },
    detached() {
      unsubscribe?.();
      unsubscribe = null;
    },
  },

  methods: {
    noop() {
      // 阻止弹窗内滑动穿透
    },

    onAgree() {
      resolvePrivacyAgree();
      this.setData({ visible: false });
    },

    onDisagree() {
      resolvePrivacyDisagree();
      this.setData({ visible: false });
      wx.showToast({ title: "需要同意后才能使用该功能", icon: "none" });
    },

    onOpenContract() {
      wx.openPrivacyContract({
        fail: () => {
          wx.showToast({ title: "暂时无法打开隐私指引", icon: "none" });
        },
      });
    },
  },
});
