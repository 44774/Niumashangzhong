import postgres from "postgres";
import { loadConfig } from "../config.js";
import { runMigrations } from "./migrate-core.js";

async function main() {
  const config = loadConfig();
  const url = process.env.MIGRATE_DATABASE_URL ?? config.databaseUrl;
  const sql = postgres(url, { max: 1 });
  try {
    await runMigrations(sql);
    console.log("数据库已是最新");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
