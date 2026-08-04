/* 云数据库文档 → 小程序共享类型（与 packages/shared-types 对齐） */

export function toUser(doc: any) {
  return {
    id: doc.openid ?? doc._id,
    displayName: doc.displayName,
    avatarUrl: null,
    timezone: doc.timezone,
    locale: "zh-CN",
    defaultCity: doc.defaultCity ?? null,
  };
}

export function toWorkspace(doc: any) {
  return {
    id: doc._id,
    type: doc.type,
    name: doc.name,
    timezone: doc.timezone,
    roleCode: "owner",
  };
}

export function toShiftTemplate(doc: any) {
  return {
    id: doc._id,
    name: doc.name,
    shortName: doc.shortName,
    kind: doc.kind,
    color: doc.color,
    startTime: doc.startTime ? String(doc.startTime).slice(0, 5) : null,
    endTime: doc.endTime ? String(doc.endTime).slice(0, 5) : null,
    endsNextDay: Boolean(doc.endsNextDay),
    unpaidBreakMinutes: doc.unpaidBreakMinutes ?? 0,
    defaultLocationId: doc.defaultLocationId ?? null,
    version: doc.version ?? 1,
    isActive: doc.isActive !== false,
    sortOrder: doc.sortOrder ?? 0,
  };
}

export function toScheduleInstance(doc: any) {
  return {
    id: doc._id,
    ownerUserId: doc.ownerOpenid,
    businessDate: doc.businessDate,
    timezone: doc.timezone,
    startsAt: doc.startsAt ?? null,
    endsAt: doc.endsAt ?? null,
    kind: doc.kind,
    status: doc.status,
    source: doc.source,
    shiftSnapshot: doc.shiftSnapshot,
    locationSnapshot: doc.locationSnapshot ?? null,
    note: doc.note ?? null,
    version: doc.version ?? 1,
  };
}

export function toChangeRequest(doc: any) {
  return {
    id: doc._id,
    scheduleInstanceId: doc.scheduleInstanceId,
    status: doc.status,
    originalSnapshot: doc.originalSnapshot,
    requestedSnapshot: doc.requestedSnapshot,
    reason: doc.reason ?? null,
    approvalNote: doc.approvalNote ?? null,
    createdAt: doc.createdAt,
    decidedAt: doc.decidedAt ?? null,
  };
}

export function toShareSnapshot(doc: any) {
  return {
    id: doc._id,
    ownerDisplayName: doc.snapshot?.ownerDisplayName ?? null,
    rangeStart: doc.rangeStart,
    rangeEnd: doc.rangeEnd,
    templateCode: doc.templateCode,
    privacyOptions: doc.privacyOptions,
    entries: doc.snapshot?.entries ?? [],
    createdAt: doc.createdAt,
  };
}
