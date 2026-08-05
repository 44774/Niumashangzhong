import { beforeEach, describe, expect, it } from "vitest";
import {
  PRIVACY_AGREEMENT_VERSION,
  getAgreedPrivacyVersion,
  hasAgreedPrivacyAgreement,
  markPrivacyAgreementAgreed,
} from "../utils/privacy-agreement";

const storage = new Map<string, unknown>();

beforeEach(() => {
  storage.clear();
  (globalThis as unknown as { wx: unknown }).wx = {
    getStorageSync: (key: string) => storage.get(key) ?? "",
    setStorageSync: (key: string, value: unknown) => {
      storage.set(key, value);
    },
    removeStorageSync: (key: string) => {
      storage.delete(key);
    },
  };
});

describe("用户隐私协议版本管理", () => {
  it("未同意时返回版本 0 且判定未同意", () => {
    expect(getAgreedPrivacyVersion()).toBe(0);
    expect(hasAgreedPrivacyAgreement()).toBe(false);
  });

  it("同意后记录当前版本并判定已同意", () => {
    markPrivacyAgreementAgreed();
    expect(getAgreedPrivacyVersion()).toBe(PRIVACY_AGREEMENT_VERSION);
    expect(hasAgreedPrivacyAgreement()).toBe(true);
  });

  it("旧版本同意记录在协议升级后判定为未同意", () => {
    storage.set("wc_privacy_agreement_version", PRIVACY_AGREEMENT_VERSION - 1);
    expect(hasAgreedPrivacyAgreement()).toBe(false);
  });
});
