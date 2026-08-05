import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  registerPrivacyHandler,
  resolvePrivacyAgree,
  resolvePrivacyDisagree,
  subscribePrivacyRequest,
} from "../services/privacy";

type PrivacyResolve = (res: { buttonId?: string; event?: string }) => void;

describe("隐私授权服务", () => {
  let handler: ((resolve: PrivacyResolve) => void) | null = null;
  const wxMock = {
    onNeedPrivacyAuthorization: vi.fn((fn: (resolve: PrivacyResolve) => void) => {
      handler = fn;
    }),
  };

  beforeEach(() => {
    (globalThis as unknown as { wx: unknown }).wx = wxMock;
  });

  it("触发隐私需求时通知订阅者并上报曝光", () => {
    registerPrivacyHandler();
    const subscriber = vi.fn();
    subscribePrivacyRequest(subscriber);
    let resolved: { buttonId?: string; event?: string } | undefined;
    handler?.((res) => {
      resolved = res;
    });
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(resolved).toEqual({ event: "exposureAuthorization" });
  });

  it("同意后以同意按钮 ID 回调平台", () => {
    registerPrivacyHandler();
    let resolved: { buttonId?: string; event?: string } | undefined;
    handler?.((res) => {
      resolved = res;
    });
    resolvePrivacyAgree();
    expect(resolved).toEqual({ buttonId: "agree-btn", event: "agree" });
  });

  it("拒绝后以不同意回调平台", () => {
    registerPrivacyHandler();
    let resolved: { buttonId?: string; event?: string } | undefined;
    handler?.((res) => {
      resolved = res;
    });
    resolvePrivacyDisagree();
    expect(resolved).toEqual({ event: "disagree" });
  });
});
