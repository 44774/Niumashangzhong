import type { User, Workspace } from "../typings/api";
import { USE_CLOUDBASE } from "../config";

const TOKEN_KEY = "wc_token";
const WORKSPACE_KEY = "wc_workspace";
const USER_KEY = "wc_user";

export function getToken(): string {
  if (USE_CLOUDBASE) {
    return "cloud-token";
  }
  return (wx.getStorageSync(TOKEN_KEY) as string) || "";
}

export function setSession(accessToken: string, user: User, workspace: Workspace): void {
  wx.setStorageSync(TOKEN_KEY, accessToken);
  wx.setStorageSync(USER_KEY, user);
  wx.setStorageSync(WORKSPACE_KEY, workspace);
}

export function clearSession(): void {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(USER_KEY);
  wx.removeStorageSync(WORKSPACE_KEY);
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
