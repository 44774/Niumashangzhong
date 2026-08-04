import type { FastifyInstance } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { memberships, workspaces } from "../../db/schema.js";
import { currentUserId, requireAuth } from "../../lib/auth.js";
import { toWorkspace } from "../../lib/mappers.js";

export async function workspaceRoutes(app: FastifyInstance, opts: { db: Db }): Promise<void> {
  const { db } = opts;
  app.get(
    "/workspaces",
    { schema: { tags: ["Workspaces"] } },
    async (req) => {
      await requireAuth(req);
      const userId = currentUserId(req);
      const rows = await db
        .select({
          workspace: workspaces,
          roleCode: memberships.roleCode,
        })
        .from(memberships)
        .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
        .where(
          and(
            eq(memberships.userId, userId),
            eq(memberships.status, "active"),
            isNull(workspaces.deletedAt),
          ),
        )
        .orderBy(workspaces.createdAt);
      return rows.map((r) => toWorkspace(r.workspace, r.roleCode));
    },
  );
}
