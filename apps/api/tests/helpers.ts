import postgres from "postgres";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createDb, type Db } from "../src/db/client.js";
import { runMigrations } from "../src/scripts/migrate-core.js";

export interface TestContext {
  app: FastifyInstance;
  db: Db;
}

export async function resetTestDb(): Promise<void> {
  const config = loadConfig();
  const sql = postgres(config.databaseUrlTest, { max: 1 });
  try {
    await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await runMigrations(sql);
  } finally {
    await sql.end();
  }
}

export async function createTestApp(weatherProvider = "mock"): Promise<TestContext> {
  const config = {
    ...loadConfig(),
    env: "test",
    weatherProvider,
  };
  const db = createDb(config.databaseUrlTest);
  const app = await buildApp({ db, config });
  return { app, db };
}

export interface LoginResult {
  accessToken: string;
  user: { id: string; displayName: string };
  workspace: { id: string; timezone: string; type?: string };
}

export async function devLogin(
  app: FastifyInstance,
  displayName = "测试用户",
  code?: string,
): Promise<LoginResult> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/dev",
    payload: code ? { displayName, code } : { displayName },
  });
  if (res.statusCode !== 200) {
    throw new Error(`登录失败: ${res.statusCode} ${res.body}`);
  }
  return res.json() as LoginResult;
}

export function authHeaders(token: string, workspaceId: string) {
  return {
    authorization: `Bearer ${token}`,
    "x-workspace-id": workspaceId,
    "content-type": "application/json",
  };
}
