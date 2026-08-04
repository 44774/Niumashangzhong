import type {
  AuthResponse,
  ChangeRequest,
  ChangeRequestInput,
  NotificationPreferences,
  ScheduleCreateInput,
  ScheduleDetail,
  ScheduleInstance,
  ScheduleRuleCreateResult,
  ScheduleRuleInput,
  ScheduleUpdateInput,
  ShareSnapshot,
  ShareSnapshotInput,
  ShiftTemplate,
  ShiftTemplateInput,
  User,
  WeatherForecast,
  Workspace,
} from "../typings/api";
import { request } from "./request";
import type { HolidayMap, WeatherLocation } from "../typings/api";
import { readHolidayCache, sliceHolidayMap } from "../utils/holiday";
import { setDefaultLocation } from "../stores/location";

export const api = {
  loginDev(displayName: string): Promise<AuthResponse> {
    return request("/auth/dev", { method: "POST", data: { displayName } });
  },

  loginWechat(code: string, displayName?: string): Promise<AuthResponse> {
    return request("/auth/wechat", { method: "POST", data: { code, displayName } });
  },

  me(): Promise<User> {
    return request("/auth/me");
  },

  workspaces(): Promise<Workspace[]> {
    return request("/workspaces");
  },

  shiftTemplates(activeOnly = true): Promise<ShiftTemplate[]> {
    return request(`/shift-templates?active=${activeOnly ? "true" : "false"}`);
  },

  createShiftTemplate(input: ShiftTemplateInput): Promise<ShiftTemplate> {
    return request("/shift-templates", { method: "POST", data: input });
  },

  updateShiftTemplate(id: string, input: ShiftTemplateInput & { version: number; isActive?: boolean }): Promise<ShiftTemplate> {
    return request(`/shift-templates/${id}`, { method: "PATCH", data: input });
  },

  schedules(from: string, to: string): Promise<ScheduleInstance[]> {
    return request(`/schedules?from=${from}&to=${to}`);
  },

  scheduleDetail(id: string): Promise<ScheduleDetail> {
    return request(`/schedules/${id}`);
  },

  createSchedule(input: ScheduleCreateInput): Promise<ScheduleInstance> {
    return request("/schedules", { method: "POST", data: input, idempotencyKey: `schedule:${input.businessDate}:${Date.now()}` });
  },

  updateSchedule(id: string, input: ScheduleUpdateInput): Promise<ScheduleInstance> {
    return request(`/schedules/${id}`, { method: "PATCH", data: input, idempotencyKey: `schedule-update:${id}:${Date.now()}` });
  },

  createRule(input: ScheduleRuleInput): Promise<ScheduleRuleCreateResult> {
    return request("/schedule-rules", { method: "POST", data: input });
  },

  createChangeRequest(input: ChangeRequestInput): Promise<ChangeRequest> {
    return request("/change-requests", { method: "POST", data: input, idempotencyKey: `change:${input.scheduleInstanceId}:${Date.now()}` });
  },

  changeRequests(status?: string): Promise<ChangeRequest[]> {
    return request(`/change-requests${status ? `?status=${status}` : ""}`);
  },

  weather(from: string, to: string, city?: string | WeatherLocation): Promise<WeatherForecast[]> {
    const cityName = typeof city === "string" ? city : city?.name;
    return request(`/weather?from=${from}&to=${to}${cityName ? `&city=${encodeURIComponent(cityName)}` : ""}`);
  },

  notificationPreferences(): Promise<NotificationPreferences> {
    return request("/notification-preferences");
  },

  saveNotificationPreferences(prefs: NotificationPreferences): Promise<NotificationPreferences> {
    return request("/notification-preferences", { method: "PUT", data: prefs });
  },

  createShareSnapshot(input: ShareSnapshotInput): Promise<ShareSnapshot> {
    return request("/share-snapshots", { method: "POST", data: input });
  },

  holidayRange(from: string, to: string): Promise<HolidayMap> {
    return Promise.resolve(sliceHolidayMap(readHolidayCache(), from, to));
  },

  async updateLocation(location: WeatherLocation): Promise<User> {
    setDefaultLocation(location);
    const me = await this.me();
    return { ...me, defaultLocation: location };
  },
};
