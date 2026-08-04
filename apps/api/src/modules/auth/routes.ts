import type { FastifyInstance } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import type { AuthResponse } from "@workcal/shared-types";
import type { Db } from "../../db/client.js";
import { memberships, users, workspaces } from "../../db/schema.js";
import { requireAuth } from "../../lib/auth.js";
import { AppError } from "../../lib/errors.js";
import { toUser, toWorkspace } from "../../lib/mappers.js";
import { DEFAULT_TEMPLATES } from "../../lib/defaults.js";
import { shiftTemplates } from "../../db/schema.js";

interface WechatBody {
  code?: string;
  displayName?: string;
}

export async function authRoutes(
  app: FastifyInstance,
  opts: { db: Db; wechatAppId: string; wechatSecret: string },
): Promise<void> {
  const { db, wechatAppId, wechatSecret } = opts;

  app.post<{ Body: WechatBody }>(
    "/auth/wechat",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          properties: {
            code: { type: "string" },
            displayName: { type: "string", maxLength: 80 },
          },
        },
      },
    },
    async (req, reply) => {
      const body = req.body ?? {};
      let openid: string;
      if (wechatAppId && wechatSecret) {
        openid = await wechatCode2Session(wechatAppId, wechatSecret, body.code ?? "");
      } else {
        openid = body.code && body.code.startsWith("dev:") ? body.code : "dev-user";
      }
      const displayName = body.displayName?.trim() || (openid === "dev-user" ? "开发用户" : "微信用户");
      const result = await getOrCreateAuthContext(db, openid, displayName);
      const accessToken = app.jwt.sign({ sub: result.user.id });
      reply.code(200).send({ accessToken, ...result } satisfies AuthResponse);
    },
  );

  app.post<{ Body: WechatBody }>(
    "/auth/dev",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          properties: { displayName: { type: "string", maxLength: 80 } },
        },
      },
    },
    async (req, reply) => {
      const displayName = req.body?.displayName?.trim() || "开发用户";
      const openid = `dev:${displayName}`;
      const result = await getOrCreateAuthContext(db, openid, displayName);
      const accessToken = app.jwt.sign({ sub: result.user.id });
      reply.code(200).send({ accessToken, ...result } satisfies AuthResponse);
    },
  );

  app.get(
    "/auth/me",
    {
      schema: { tags: ["Auth"] },
    },
    async (req) => {
      const userId = await requireAuth(req);
      const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (rows.length === 0) throw new AppError("NOT_FOUND", "用户不存在", 404);
      const me = rows[0];
      if (!me) throw new AppError("NOT_FOUND", "用户不存在", 404);
      return toUser(me);
    },
  );
}

async function wechatCode2Session(appId: string, secret: string, code: string): Promise<string> {
  if (!code) {
    throw new AppError("WECHAT_LOGIN_FAILED", "缺少微信登录 code", 401);
  }
  const url =
    `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appId)}` +
    `&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
  const res = await fetch(url);
  const data = (await res.json()) as { openid?: string; errcode?: number; errmsg?: string };
  if (!data.openid) {
    throw new AppError("WECHAT_LOGIN_FAILED", data.errmsg ?? "微信登录失败", 401);
  }
  return data.openid;
}

export async function getOrCreateAuthContext(
  db: Db,
  openid: string,
  displayName: string,
): Promise<{ user: ReturnType<typeof toUser>; workspace: ReturnType<typeof toWorkspace> }> {
  let userRow = await db
    .select()
    .from(users)
    .where(and(eq(users.wechatOpenid, openid), isNull(users.deletedAt)))
    .limit(1)
  if (userRow.length === 0) {
    const inserted = await db
      .insert(users)
      .values({
        wechatOpenid: openid,
        displayName,
        defaultCity: "深圳",
      })
      .returning();
    userRow = inserted;
  }
  const user = userRow[0];
  if (!user) {
    throw new AppError("INTERNAL", "用户创建失败", 500);
  }

  let workspaceRow = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.ownerUserId, user.id), eq(workspaces.type, "personal")))
    .limit(1);
  if (workspaceRow.length === 0) {
    const inserted = await db
      .insert(workspaces)
      .values({
        type: "personal",
        name: `${displayName}的个人空间`,
        ownerUserId: user.id,
        timezone: user.timezone,
        defaultCity: user.defaultCity ?? "深圳",
      })
      .returning();
    workspaceRow = inserted;
    const wsRow = workspaceRow[0];
    if (!wsRow) {
      throw new AppError("INTERNAL", "工作空间创建失败", 500);
    }
    await db.insert(memberships).values({
      workspaceId: wsRow.id,
      userId: user.id,
      roleCode: "owner",
      status: "active",
      joinedAt: new Date(),
    });
    for (const tpl of DEFAULT_TEMPLATES) {
      await db.insert(shiftTemplates).values({
        workspaceId: wsRow.id,
        name: tpl.name,
        shortName: tpl.shortName,
        kind: tpl.kind,
        color: tpl.color,
        startTime: tpl.startTime,
        endTime: tpl.endTime,
        endsNextDay: tpl.endsNextDay,
        unpaidBreakMinutes: tpl.unpaidBreakMinutes,
        sortOrder: tpl.sortOrder,
        createdBy: user.id,
      });
    }
  }
  const workspace = workspaceRow[0];
  if (!workspace) {
    throw new AppError("INTERNAL", "工作空间不存在", 500);
  }
  const membership = await db
    .select()
    .from(memberships)
    .where(
      and(eq(memberships.workspaceId, workspace.id), eq(memberships.userId, user.id)),
    )
    .limit(1);
  return {
    user: toUser(user),
    workspace: toWorkspace(workspace, membership[0]?.roleCode ?? "owner"),
  };
}
