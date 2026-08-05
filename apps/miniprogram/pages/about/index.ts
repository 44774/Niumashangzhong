import { APP_NAME, APP_VERSION } from "../../utils/version";
import { PRIVACY_ITEMS, PRIVACY_USAGE_RULE } from "../../utils/privacy";

Page({
  data: {
    appName: APP_NAME,
    version: APP_VERSION,
    privacyRule: PRIVACY_USAGE_RULE,
    privacyItems: PRIVACY_ITEMS,
  },
});
