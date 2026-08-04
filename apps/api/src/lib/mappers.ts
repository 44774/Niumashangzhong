import type {
  ChangeRequest,
  NotificationPreferences,
  ScheduleInstance,
  ShiftSnapshot,
  ShiftTemplate,
  User,
  Workspace,
} from "@workcal/shared-types";
import {
  scheduleChangeRequests,
  scheduleInstances,
  shiftTemplates,
  users,
  workspaces,
} from "../db/schema.js";

type UserRow = typeof users.$inferSelect;
type WorkspaceRow = typeof workspaces.$inferSelect;
type TemplateRow = typeof shiftTemplates.$inferSelect;
type InstanceRow = typeof scheduleInstances.$inferSelect;
type ChangeRequestRow = typeof scheduleChangeRequests.$inferSelect;

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    timezone: row.timezone,
    locale: row.locale,
    defaultCity: row.defaultCity,
  };
}

export function toWorkspace(row: WorkspaceRow, roleCode: string): Workspace {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    timezone: row.timezone,
    roleCode,
  };
}

export function toShiftTemplate(row: TemplateRow): ShiftTemplate {
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    kind: row.kind,
    color: row.color,
    startTime: row.startTime ? row.startTime.slice(0, 5) : null,
    endTime: row.endTime ? row.endTime.slice(0, 5) : null,
    endsNextDay: row.endsNextDay,
    unpaidBreakMinutes: row.unpaidBreakMinutes,
    defaultLocationId: row.defaultLocationId,
    version: row.version ?? 1,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

export function snapshotFromTemplate(row: TemplateRow): ShiftSnapshot {
  return {
    name: row.name,
    shortName: row.shortName,
    kind: row.kind,
    color: row.color,
    startTime: row.startTime ? row.startTime.slice(0, 5) : null,
    endTime: row.endTime ? row.endTime.slice(0, 5) : null,
    endsNextDay: row.endsNextDay,
    unpaidBreakMinutes: row.unpaidBreakMinutes,
  };
}

export function toScheduleInstance(row: InstanceRow): ScheduleInstance {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    businessDate: row.businessDate,
    timezone: row.timezone,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    kind: row.kind,
    status: row.status,
    source: row.source,
    shiftSnapshot: row.shiftSnapshot,
    locationSnapshot: row.locationSnapshot,
    note: row.note,
    version: row.version,
  };
}

export function toChangeRequest(row: ChangeRequestRow): ChangeRequest {
  return {
    id: row.id,
    scheduleInstanceId: row.scheduleInstanceId,
    businessDate: row.businessDate ?? row.createdAt.toISOString().slice(0, 10),
    status: row.status,
    originalSnapshot: row.originalSnapshot,
    requestedSnapshot: row.requestedSnapshot,
    reason: row.reason,
    approvalNote: row.approvalNote,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
  };
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  shiftReminders: [15],
  weatherEnabled: true,
  scheduleChangesEnabled: true,
  approvalEnabled: true,
  quietHours: null,
  channels: { wechat: true },
};

export function toNotificationPreferences(row: {
  shiftReminders: number[];
  weatherEnabled: boolean;
  scheduleChangesEnabled: boolean;
  approvalEnabled: boolean;
  quietHours: { start: string; end: string } | null;
  channels: Record<string, boolean>;
}): NotificationPreferences {
  return {
    shiftReminders: row.shiftReminders,
    weatherEnabled: row.weatherEnabled,
    scheduleChangesEnabled: row.scheduleChangesEnabled,
    approvalEnabled: row.approvalEnabled,
    quietHours: row.quietHours,
    channels: row.channels,
  };
}
