import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { extendRules, processDueJobs } from "./lib/notifications.js";

async function main() {
  const config = loadConfig();
  const db = createDb(config.databaseUrl);
  const app = await buildApp({ db, config });

  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`API 已启动: http://127.0.0.1:${config.port} (docs: /docs)`);

  const timer = setInterval(() => {
    void (async () => {
      try {
        await processDueJobs(db);
        await extendRules(db);
      } catch (err) {
        console.error("[scheduler]", (err as Error).message);
      }
    })();
  }, 30_000);

  const shutdown = async () => {
    clearInterval(timer);
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
