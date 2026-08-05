/** 用户隐私协议版本号：协议内容有更新时 +1，已同意的用户会再次被要求确认 */
export const PRIVACY_AGREEMENT_VERSION = 1;

const AGREED_VERSION_KEY = "wc_privacy_agreement_version";
const AGREED_AT_KEY = "wc_privacy_agreement_agreed_at";

export function getAgreedPrivacyVersion(): number {
  const value = wx.getStorageSync(AGREED_VERSION_KEY);
  return typeof value === "number" ? value : 0;
}

export function hasAgreedPrivacyAgreement(): boolean {
  return getAgreedPrivacyVersion() >= PRIVACY_AGREEMENT_VERSION;
}

export function markPrivacyAgreementAgreed(): void {
  wx.setStorageSync(AGREED_VERSION_KEY, PRIVACY_AGREEMENT_VERSION);
  wx.setStorageSync(AGREED_AT_KEY, new Date().toISOString());
}
