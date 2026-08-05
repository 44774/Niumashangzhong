type PrivacyResolve = (res: { buttonId?: string; event?: string }) => void;
type PrivacyListener = (resolve: PrivacyResolve, eventInfo?: { referrer?: string }) => void;

interface PrivacyWx {
  onNeedPrivacyAuthorization?: (listener: PrivacyListener) => void;
}

let pendingResolve: PrivacyResolve | null = null;
let registered = false;
const listeners = new Set<() => void>();

/** 在小程序启动时注册一次（onNeedPrivacyAuthorization 为覆盖式监听，只能注册一次） */
export function registerPrivacyHandler(): void {
  if (registered) return;
  const privacyWx = wx as unknown as PrivacyWx;
  if (!privacyWx.onNeedPrivacyAuthorization) return;
  registered = true;
  privacyWx.onNeedPrivacyAuthorization((resolve) => {
    pendingResolve = resolve;
    try {
      // 弹窗曝光告知平台
      resolve({ event: "exposureAuthorization" });
    } catch {
      // 曝光上报失败不阻塞流程
    }
    listeners.forEach((fn) => fn());
  });
}

export function subscribePrivacyRequest(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function resolvePrivacyAgree(): void {
  const resolve = pendingResolve;
  pendingResolve = null;
  if (resolve) resolve({ buttonId: "agree-btn", event: "agree" });
}

export function resolvePrivacyDisagree(): void {
  const resolve = pendingResolve;
  pendingResolve = null;
  if (resolve) resolve({ event: "disagree" });
}
