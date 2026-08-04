import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
export const migrationsDir = join(here, "../../../../database/migrations");

export async function runMigrations(sql: ReturnType<typeof postgres>): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const applied = await sql`SELECT 1 FROM schema_migrations WHERE id = ${file}`;
    if (applied.length > 0) continue;
    const content = readFileSync(join(migrationsDir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`INSERT INTO schema_migrations (id) VALUES (${file})`;
    });
    console.log(`迁移完成: ${file}`);
  }
}
