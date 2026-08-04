import { getLoginMode } from "../stores/session";
import { api as cloudApi } from "./api-cloud";
import { api as httpApi } from "./api-http";
import { api as localApi } from "./api-local";

// 统一出口：按当前登录模式动态切换 云开发 / 本地存储 / 本地 HTTP API
function current() {
  const mode = getLoginMode();
  if (mode === "local") return localApi;
  if (mode === "cloud") return cloudApi;
  return httpApi;
}

export const api = {
  loginDev: (displayName: string) => current().loginDev(displayName),
  loginWechat: (code: string, displayName?: string) => current().loginWechat(code, displayName),
  me: () => current().me(),
  workspaces: () => current().workspaces(),
  shiftTemplates: (activeOnly?: boolean) => current().shiftTemplates(activeOnly),
  createShiftTemplate: (input: Parameters<typeof cloudApi.createShiftTemplate>[0]) =>
    current().createShiftTemplate(input),
  updateShiftTemplate: (
    id: string,
    input: Parameters<typeof cloudApi.updateShiftTemplate>[1],
  ) => current().updateShiftTemplate(id, input),
  schedules: (from: string, to: string) => current().schedules(from, to),
  scheduleDetail: (id: string) => current().scheduleDetail(id),
  createSchedule: (input: Parameters<typeof cloudApi.createSchedule>[0]) =>
    current().createSchedule(input),
  updateSchedule: (id: string, input: Parameters<typeof cloudApi.updateSchedule>[1]) =>
    current().updateSchedule(id, input),
  createRule: (input: Parameters<typeof cloudApi.createRule>[0]) => current().createRule(input),
  listRules: () => current().listRules(),
  switchRule: (ruleId: string) => current().switchRule(ruleId),
  removeRule: (ruleId: string) => current().removeRule(ruleId),
  updateRule: (input: Parameters<typeof cloudApi.updateRule>[0]) => current().updateRule(input),
  createChangeRequest: (input: Parameters<typeof cloudApi.createChangeRequest>[0]) =>
    current().createChangeRequest(input),
  changeRequests: (status?: string) => current().changeRequests(status),
  changeRequestsInRange: (from: string, to: string, page?: number) =>
    current().changeRequestsInRange(from, to, page),
  removeChangeRequest: (id: string) => current().removeChangeRequest(id),
  weather: (
    from: string,
    to: string,
    location?: Parameters<typeof cloudApi.weather>[2],
  ) => current().weather(from, to, location),
  notificationPreferences: () => current().notificationPreferences(),
  saveNotificationPreferences: (
    prefs: Parameters<typeof cloudApi.saveNotificationPreferences>[0],
  ) => current().saveNotificationPreferences(prefs),
  createShareSnapshot: (input: Parameters<typeof cloudApi.createShareSnapshot>[0]) =>
    current().createShareSnapshot(input),
  holidayRange: (from: string, to: string) => current().holidayRange(from, to),
  updateLocation: (location: Parameters<typeof cloudApi.updateLocation>[0]) =>
    current().updateLocation(location),
};

/** 本地登录：数据仅保存在当前设备，不经过云端 */
export function loginLocal(displayName: string) {
  return localApi.loginDev(displayName);
}
