import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Db = ReturnType<typeof drizzle<typeof schema>>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export function createDb(databaseUrl: string): Db {
  const sql = postgres(databaseUrl, { max: 10, prepare: false });
  return drizzle(sql, { schema });
}
