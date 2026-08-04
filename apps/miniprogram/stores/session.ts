import type { User, Workspace } from "../typings/api";
import { USE_CLOUDBASE } from "../config";

const TOKEN_KEY = "wc_token";
const WORKSPACE_KEY = "wc_workspace";
const USER_KEY = "wc_user";
const MODE_KEY = "wc_login_mode";

export type LoginMode = "cloud" | "local" | "http";

export function getLoginMode(): LoginMode {
  const stored = wx.getStorageSync(MODE_KEY) as LoginMode | "";
  if (stored) return stored;
  return USE_CLOUDBASE ? "cloud" : "http";
}

export function setLoginMode(mode: LoginMode): void {
  wx.setStorageSync(MODE_KEY, mode);
}

export function getToken(): string {
  const mode = getLoginMode();
  if (mode === "local") {
    return (wx.getStorageSync(USER_KEY) as User | "") ? "local-token" : "";
  }
  if (USE_CLOUDBASE) {
    return (wx.getStorageSync(TOKEN_KEY) as string) || "";
  }
  return (wx.getStorageSync(TOKEN_KEY) as string) || "";
}

export function setSession(
  accessToken: string,
  user: User,
  workspace: Workspace,
  mode?: LoginMode,
): void {
  wx.setStorageSync(TOKEN_KEY, accessToken);
  wx.setStorageSync(USER_KEY, user);
  wx.setStorageSync(WORKSPACE_KEY, workspace);
  if (mode) setLoginMode(mode);
}

export function setLocalSession(user: User, workspace: Workspace): void {
  setLoginMode("local");
  wx.setStorageSync(TOKEN_KEY, "local-token");
  wx.setStorageSync(USER_KEY, user);
  wx.setStorageSync(WORKSPACE_KEY, workspace);
}

export function clearSession(): void {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(USER_KEY);
  wx.removeStorageSync(WORKSPACE_KEY);
  wx.removeStorageSync(MODE_KEY);
}

export function getWorkspace(): Workspace | null {
  return (wx.getStorageSync(WORKSPACE_KEY) as Workspace) || null;
}

export function getWorkspaceId(): string {
  return getWorkspace()?.id ?? "";
}

export function getUser(): User | null {
  return (wx.getStorageSync(USER_KEY) as User) || null;
}
