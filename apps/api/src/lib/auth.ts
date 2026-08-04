import type { FastifyRequest } from "fastify";
import { eq, and } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { memberships, workspaces } from "../db/schema.js";
import { forbidden, unauthorized } from "./errors.js";

export function currentUserId(req: FastifyRequest): string {
  const payload = req.user as unknown as { sub?: string } | undefined;
  if (!payload?.sub) {
    throw unauthorized();
  }
  return payload.sub;
}

export async function requireAuth(req: FastifyRequest): Promise<string> {
  try {
    await req.jwtVerify();
  } catch {
    throw unauthorized();
  }
  return currentUserId(req);
}

export interface WorkspaceContext {
  workspaceId: string;
  timezone: string;
  roleCode: string;
}

export async function requireWorkspace(req: FastifyRequest, db: Db): Promise<WorkspaceContext> {
  const userId = currentUserId(req);
  const header = req.headers["x-workspace-id"];
  if (!header || Array.isArray(header) || header.length === 0) {
    throw forbidden("缺少 X-Workspace-Id 请求头");
  }
  const rows = await db
    .select({
      workspace: workspaces,
      roleCode: memberships.roleCode,
    })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(
      and(
        eq(memberships.workspaceId, header),
        eq(memberships.userId, userId),
        eq(memberships.status, "active"),
      ),
    )
    .limit(1);
  if (rows.length === 0) {
    throw forbidden("无权访问该工作空间");
  }
  const row = rows[0];
  if (!row) {
    throw forbidden("无权访问该工作空间");
  }
  return {
    workspaceId: row.workspace.id,
    timezone: row.workspace.timezone,
    roleCode: row.roleCode,
  };
}
