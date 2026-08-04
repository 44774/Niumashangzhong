import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const base = join(root, "apps/miniprogram/cloudfunctions");

async function buildOne(name) {
  await build({
    entryPoints: [join(base, name, "src/index.ts")],
    outfile: join(base, name, "index.js"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node16",
    external: ["wx-server-sdk"],
    logLevel: "info",
  });
  console.log(`云函数已构建: ${name}/index.js`);
}

await buildOne("api");
await buildOne("dispatcher");
