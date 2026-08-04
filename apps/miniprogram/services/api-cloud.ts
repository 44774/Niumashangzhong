import { getWorkspace, getWorkspaceId, setSession } from "../stores/session";
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
  ScheduleRuleSummary,
  ScheduleUpdateInput,
  ShareSnapshot,
  ShareSnapshotInput,
  ShiftTemplate,
  ShiftTemplateInput,
  User,
  WeatherForecast,
  WeatherLocation,
  HolidayMap,
  Workspace,
} from "../typings/api";
import { getDefaultLocation } from "../stores/location";
import { callCloud } from "./cloud";

const CLOUD_TOKEN = "cloud-token";

async function authResult(displayName?: string): Promise<AuthResponse> {
  const result = await callCloud<{ user: User; workspace: Workspace }>("auth.me", {
    displayName: displayName ?? "",
  });
  setSession(CLOUD_TOKEN, result.user, result.workspace, "cloud");
  return { accessToken: CLOUD_TOKEN, ...result };
}

function ws<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  return callCloud<T>(action, { workspaceId: getWorkspaceId(), ...payload });
}

export const api = {
  async loginDev(displayName: string): Promise<AuthResponse> {
    return authResult(displayName);
  },

  async loginWechat(_code: string, displayName?: string): Promise<AuthResponse> {
    return authResult(displayName);
  },

  async me(): Promise<User> {
    const result = await authResult();
    return result.user;
  },

  async workspaces(): Promise<Workspace[]> {
    return callCloud<Workspace[]>("workspaces.list");
  },

  async shiftTemplates(activeOnly = true): Promise<ShiftTemplate[]> {
    return ws<ShiftTemplate[]>("shift.list", { active: activeOnly });
  },

  async createShiftTemplate(input: ShiftTemplateInput): Promise<ShiftTemplate> {
    return ws<ShiftTemplate>("shift.create", { ...input });
  },

  async updateShiftTemplate(
    id: string,
    input: ShiftTemplateInput & { version: number; isActive?: boolean },
  ): Promise<ShiftTemplate> {
    return ws<ShiftTemplate>("shift.update", { id, ...input });
  },

  async schedules(from: string, to: string): Promise<ScheduleInstance[]> {
    return ws<ScheduleInstance[]>("schedule.list", { from, to });
  },

  async scheduleDetail(id: string): Promise<ScheduleDetail> {
    return ws<ScheduleDetail>("schedule.detail", { id });
  },

  async createSchedule(input: ScheduleCreateInput): Promise<ScheduleInstance> {
    return ws<ScheduleInstance>("schedule.create", { ...input });
  },

  async updateSchedule(id: string, input: ScheduleUpdateInput): Promise<ScheduleInstance> {
    return ws<ScheduleInstance>("schedule.update", { id, ...input });
  },

  async createRule(input: ScheduleRuleInput): Promise<ScheduleRuleCreateResult> {
    return ws<ScheduleRuleCreateResult>("rule.create", { ...input });
  },

  async listRules(): Promise<ScheduleRuleSummary[]> {
    return ws<ScheduleRuleSummary[]>("rule.list");
  },

  async switchRule(ruleId: string): Promise<{ ruleId: string }> {
    return ws<{ ruleId: string }>("rule.switch", { ruleId });
  },

  async removeRule(ruleId: string): Promise<{ removed: string }> {
    return ws<{ removed: string }>("rule.remove", { ruleId });
  },

  async createChangeRequest(input: ChangeRequestInput): Promise<ChangeRequest> {
    return ws<ChangeRequest>("change.create", { ...input });
  },

  async changeRequests(status?: string): Promise<ChangeRequest[]> {
    return ws<ChangeRequest[]>("change.list", status ? { status } : {});
  },

  async weather(
    from: string,
    to: string,
    location?: WeatherLocation | string,
  ): Promise<WeatherForecast[]> {
    const loc = typeof location === "string" ? undefined : (location ?? getDefaultLocation() ?? undefined);
    return ws<WeatherForecast[]>("weather.get", { from, to, location: loc });
  },

  async holidayRange(from: string, to: string): Promise<HolidayMap> {
    return ws<HolidayMap>("holiday.getRange", { from, to });
  },

  async updateLocation(location: WeatherLocation): Promise<User> {
    const user = await ws<User>("user.updateLocation", { location });
    const workspace = getWorkspace();
    if (workspace) setSession(CLOUD_TOKEN, user, workspace, "cloud");
    return user;
  },

  async notificationPreferences(): Promise<NotificationPreferences> {
    return ws<NotificationPreferences>("notify.get");
  },

  async saveNotificationPreferences(prefs: NotificationPreferences): Promise<NotificationPreferences> {
    return ws<NotificationPreferences>("notify.save", { prefs });
  },

  async createShareSnapshot(input: ShareSnapshotInput): Promise<ShareSnapshot> {
    return ws<ShareSnapshot>("share.create", { ...input });
  },
};
