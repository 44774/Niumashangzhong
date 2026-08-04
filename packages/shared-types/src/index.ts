/** 领域枚举 */
export type ShiftKind = "work" | "rest" | "leave" | "training" | "travel" | "custom";
export type ScheduleStatus = "scheduled" | "pending_approval" | "cancelled" | "completed";
export type ScheduleSource =
  | "manual"
  | "rule"
  | "template_copy"
  | "import"
  | "admin_batch"
  | "temporary_change";
export type ChangeStatus = "pending" | "approved" | "rejected" | "withdrawn" | "expired";
export type ChangeScope = "only_this_day" | "future_instances" | "whole_rule";
export type WorkspaceType = "personal" | "organization";
export type ConflictType = "overlap" | "insufficient_rest" | "coverage_gap" | "policy";
export type ConflictSeverity = "warning" | "error";
export type AsyncJobStatus = "pending" | "running" | "completed" | "failed";
export type NotificationStatus = "pending" | "processing" | "sent" | "failed" | "cancelled";
export type HolidayType = "holiday" | "workday";
export type HolidayMap = Record<string, HolidayType>;

export interface WeatherLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface User {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  timezone: string;
  locale: string;
  defaultCity: string | null;
  defaultLocation?: WeatherLocation | null;
}

export interface Workspace {
  id: string;
  type: WorkspaceType;
  name: string;
  timezone: string;
  roleCode: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
  workspace: Workspace;
}

export interface ShiftTemplateInput {
  name: string;
  shortName: string;
  kind: ShiftKind;
  color: string;
  startTime: string | null;
  endTime: string | null;
  endsNextDay: boolean;
  unpaidBreakMinutes: number;
  defaultLocationId?: string | null;
}

export interface ShiftTemplate extends ShiftTemplateInput {
  id: string;
  version: number;
  isActive: boolean;
  sortOrder: number;
}

export interface ShiftSnapshot {
  name: string;
  shortName: string;
  kind: ShiftKind;
  color: string;
  startTime: string | null;
  endTime: string | null;
  endsNextDay: boolean;
  unpaidBreakMinutes: number;
}

export interface CustomShift {
  name: string;
  kind: ShiftKind;
  startTime?: string | null;
  endTime?: string | null;
  endsNextDay?: boolean;
  color?: string;
  unpaidBreakMinutes?: number;
}

export interface LocationSnapshot {
  name: string;
  city: string | null;
  address: string | null;
}

export interface ScheduleCreateInput {
  ownerUserId: string;
  businessDate: string;
  shiftTemplateId?: string | null;
  customShift?: CustomShift | null;
  locationId?: string | null;
  note?: string | null;
}

export interface ScheduleInstance {
  id: string;
  ownerUserId: string;
  businessDate: string;
  timezone: string;
  startsAt: string | null;
  endsAt: string | null;
  kind: ShiftKind;
  status: ScheduleStatus;
  source: ScheduleSource;
  shiftSnapshot: ShiftSnapshot;
  locationSnapshot: LocationSnapshot | null;
  note: string | null;
  version: number;
}

export interface ScheduleDetail extends ScheduleInstance {
  weather: WeatherForecast | null;
  pendingChange: ChangeRequest | null;
  overtime?: boolean;
  history: Array<{
    version: number;
    snapshot: ShiftSnapshot;
    changeReason: string | null;
    changedBy: string | null;
    createdAt: string;
  }>;
}

export interface ScheduleUpdateInput {
  version: number;
  changeScope: ChangeScope;
  shiftTemplateId?: string | null;
  customShift?: CustomShift | null;
  locationId?: string | null;
  note?: string | null;
  reason: string;
}

export interface ScheduleRuleInput {
  ownerUserId: string;
  name?: string | null;
  startDate: string;
  endDate?: string | null;
  timezone: string;
  sequence: Array<{ shiftTemplateId: string }>;
  generationHorizonDays?: number;
}

export interface ScheduleRule extends ScheduleRuleInput {
  id: string;
  version: number;
  isActive: boolean;
}

export interface ScheduleRuleSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  timezone: string;
  sequence: Array<{ shiftTemplateId: string }>;
  generationHorizonDays: number;
  version: number;
  isActive: boolean;
  isCurrent: boolean;
}

export interface ScheduleConflict {
  type: ConflictType;
  severity: ConflictSeverity;
  message: string;
  existingScheduleId?: string | null;
}

export interface ScheduleRuleCreateResult {
  rule: ScheduleRule;
  generatedCount: number;
  conflicts: ScheduleConflict[];
}

export interface ChangeRequestInput {
  scheduleInstanceId: string;
  requestedShift: CustomShift;
  shiftTemplateId?: string | null;
  locationId?: string | null;
  reason?: string | null;
}

export interface ChangeRequest {
  id: string;
  scheduleInstanceId: string;
  status: ChangeStatus;
  originalSnapshot: ShiftSnapshot;
  requestedSnapshot: ShiftSnapshot;
  reason: string | null;
  approvalNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface WeatherForecast {
  date: string;
  conditionCode: string;
  conditionText: string;
  temperatureMin: number;
  temperatureMax: number;
  humidityPercent: number | null;
  precipitationProbability: number | null;
  windDirection: string | null;
  windLevel: string | null;
  airQuality: string | null;
  warningCodes: string[];
  updatedAt: string;
}

export interface NotificationPreferences {
  shiftReminders: number[];
  weatherEnabled: boolean;
  scheduleChangesEnabled: boolean;
  approvalEnabled: boolean;
  holidayOvertimeEnabled?: boolean;
  quietHours: { start: string; end: string } | null;
  channels: Record<string, boolean>;
}

export interface SharePrivacyOptions {
  showDisplayName: boolean;
  showTime: boolean;
  showWeather: boolean;
  showLocation: boolean;
  showNote: boolean;
}

export interface ShareSnapshotInput {
  rangeStart: string;
  rangeEnd: string;
  templateCode: string;
  privacyOptions: SharePrivacyOptions;
  entries?: ShareSnapshotEntry[];
}

export interface ShareSnapshotEntry {
  date: string;
  shiftName: string;
  shortName: string;
  kind: ShiftKind;
  color: string;
  timeText: string | null;
  location: string | null;
  note: string | null;
  weather: Pick<WeatherForecast, "conditionText" | "conditionCode" | "temperatureMin" | "temperatureMax"> | null;
  overtime?: boolean;
}

export interface ShareSnapshot {
  id: string;
  ownerDisplayName: string | null;
  rangeStart: string;
  rangeEnd: string;
  templateCode: string;
  privacyOptions: SharePrivacyOptions;
  entries: ShareSnapshotEntry[];
  createdAt: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, unknown> | null;
  };
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
