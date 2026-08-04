import type { Db, Tx } from "../db/client.js";
import { auditLogs } from "../db/schema.js";

export interface AuditInput {
  workspaceId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  requestId?: string | null;
  beforeSummary?: Record<string, unknown> | null;
  afterSummary?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

export async function writeAudit(db: Db | Tx, input: AuditInput): Promise<void> {
  await db.insert(auditLogs).values({
    workspaceId: input.workspaceId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    requestId: input.requestId ?? null,
    beforeSummary: input.beforeSummary ?? null,
    afterSummary: input.afterSummary ?? null,
    metadata: input.metadata ?? {},
  });
}
