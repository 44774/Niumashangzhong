import cloud from "wx-server-sdk";
import { CloudError, docId, nowIso } from "./util";

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV as unknown as string });

// wx-server-sdk 类型声明不完整，云函数层作为薄适配层使用宽松类型；
// 领域逻辑仍由 packages/schedule-engine（纯 TS + 单测）保证。
export const db: any = cloud.database();
export const _ = db.command;

export const COLLECTIONS = [
  "users",
  "workspaces",
  "memberships",
  "shiftTemplates",
  "scheduleInstances",
  "scheduleRules",
  "changeRequests",
  "notificationPrefs",
  "notificationJobs",
  "shareSnapshots",
  "weatherCache",
  "auditLogs",
] as const;

export interface DefaultTemplateInput {
  name: string;
  shortName: string;
  kind: "work" | "rest";
  color: string;
  startTime: string | null;
  endTime: string | null;
  endsNextDay: boolean;
  unpaidBreakMinutes: number;
  sortOrder: number;
}

export const DEFAULT_TEMPLATES: DefaultTemplateInput[] = [
  {
    name: "早班",
    shortName: "早班",
    kind: "work",
    color: "#10B981",
    startTime: "09:00",
    endTime: "17:30",
    endsNextDay: false,
    unpaidBreakMinutes: 0,
    sortOrder: 1,
  },
  {
    name: "晚班",
    shortName: "晚班",
    kind: "work",
    color: "#2F80ED",
    startTime: "13:00",
    endTime: "21:30",
    endsNextDay: false,
    unpaidBreakMinutes: 0,
    sortOrder: 2,
  },
  {
    name: "夜班",
    shortName: "夜班",
    kind: "work",
    color: "#7C3AED",
    startTime: "21:00",
    endTime: "07:00",
    endsNextDay: true,
    unpaidBreakMinutes: 0,
    sortOrder: 3,
  },
  {
    name: "休息",
    shortName: "休",
    kind: "rest",
    color: "#94A3B8",
    startTime: null,
    endTime: null,
    endsNextDay: false,
    unpaidBreakMinutes: 0,
    sortOrder: 4,
  },
];

export interface UserDoc {
  _id: string;
  openid: string;
  displayName: string;
  defaultCity: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceDoc {
  _id: string;
  type: "personal" | "organization";
  name: string;
  ownerOpenid: string;
  timezone: string;
  defaultCity: string;
  createdAt: string;
}

export async function ensureUserAndWorkspace(
  openid: string,
  displayName?: string,
): Promise<{ user: UserDoc; workspace: WorkspaceDoc }> {
  let user: UserDoc | null = null;
  try {
    const res = await db.collection("users").doc(openid).get();
    user = res.data as UserDoc;
  } catch {
    user = null;
  }
  const now = nowIso();
  if (!user) {
    user = {
      _id: openid,
      openid,
      displayName: displayName?.trim() || "微信用户",
      defaultCity: "深圳",
      timezone: "Asia/Shanghai",
      createdAt: now,
      updatedAt: now,
    };
    await db.collection("users").doc(openid).set({ data: user });
  }

  const workspaceRes = await db
    .collection("workspaces")
    .where({ ownerOpenid: openid, type: "personal" })
    .limit(1)
    .get();
  let workspace = workspaceRes.data[0] as WorkspaceDoc | undefined;
  if (!workspace) {
    const added = await db.collection("workspaces").add({
      data: {
        type: "personal",
        name: `${user.displayName}的个人空间`,
        ownerOpenid: openid,
        timezone: user.timezone,
        defaultCity: user.defaultCity,
        createdAt: now,
      },
    });
    workspace = {
      _id: added._id as string,
      type: "personal",
      name: `${user.displayName}的个人空间`,
      ownerOpenid: openid,
      timezone: user.timezone,
      defaultCity: user.defaultCity,
      createdAt: now,
    };
    await db
      .collection("memberships")
      .doc(docId([workspace._id, openid]))
      .set({
        data: {
          workspaceId: workspace._id,
          openid,
          roleCode: "owner",
          status: "active",
          joinedAt: now,
        },
      });
    for (const tpl of DEFAULT_TEMPLATES) {
      await db.collection("shiftTemplates").add({
        data: {
          workspaceId: workspace._id,
          name: tpl.name,
          shortName: tpl.shortName,
          kind: tpl.kind,
          color: tpl.color,
          startTime: tpl.startTime,
          endTime: tpl.endTime,
          endsNextDay: tpl.endsNextDay,
          unpaidBreakMinutes: tpl.unpaidBreakMinutes,
          sortOrder: tpl.sortOrder,
          isActive: true,
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
  }
  return { user, workspace };
}

export async function requireWorkspace(openid: string, workspaceId: string): Promise<void> {
  if (!workspaceId) {
    throw new CloudError("FORBIDDEN", "缺少工作空间 ID", 403);
  }
  try {
    const res = await db.collection("memberships").doc(docId([workspaceId, openid])).get();
    if (!res.data) {
      throw new Error("not found");
    }
  } catch {
    throw new CloudError("FORBIDDEN", "无权访问该工作空间", 403);
  }
}

export async function getWorkspace(workspaceId: string): Promise<WorkspaceDoc> {
  const res = await db.collection("workspaces").doc(workspaceId).get();
  if (!res.data) {
    throw new CloudError("NOT_FOUND", "工作空间不存在", 404);
  }
  return res.data as WorkspaceDoc;
}

export async function writeAudit(
  openid: string,
  workspaceId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  afterSummary: Record<string, unknown>,
): Promise<void> {
  await db.collection("auditLogs").add({
    data: {
      workspaceId,
      actorOpenid: openid,
      action,
      resourceType,
      resourceId,
      afterSummary,
      createdAt: nowIso(),
    },
  });
}
